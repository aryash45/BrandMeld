"""
core/llm.py — Shared NVIDIA LLM client factory and retry helper.

All services that call the LLM should import from here.
Routes calls to NVIDIA API catalog (integrate.api.nvidia.com).
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
import base64
import random
import httpx

logger = logging.getLogger(__name__)

DEFAULT_MODEL_ID = "nvidia/llama-3.1-nemotron-70b-instruct"
LLM_RETRY_DELAYS = (1.0, 2.0, 4.0)


def get_api_key() -> str:
    key = os.getenv("NVIDIA_API_KEY")
    if not key:
        raise RuntimeError("NVIDIA_API_KEY environment variable not set")
    return key


def get_model_id(has_image: bool = False) -> str:
    if has_image:
        return "meta/llama-3.2-11b-vision-instruct"
    env_model = os.getenv("NVIDIA_MODEL_ID")
    if env_model:
        return env_model
    return DEFAULT_MODEL_ID


def clean_json_text(text: str) -> str:
    text = text.strip()
    # 1. Try finding fenced json
    match = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    # 2. Try finding the outer-most JSON object or array
    obj_match = re.search(r"(\{.*\}|\[.*\])", text, re.DOTALL)
    if obj_match:
        return obj_match.group(1).strip()
    return text


class MockGenerateContentResponse:
    def __init__(self, text: str, parsed=None):
        self.text = text
        self.parsed = parsed


class NvidiaModels:
    def __init__(self, api_key: str):
        self.api_key = api_key

    def generate_content(self, model: str, contents, config=None) -> MockGenerateContentResponse:
        url = "https://integrate.api.nvidia.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        
        system_instruction = getattr(config, "system_instruction", None)
        response_mime_type = getattr(config, "response_mime_type", None)
        temperature = getattr(config, "temperature", None)
        response_schema = getattr(config, "response_schema", None)
        
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": str(system_instruction)})
            
        has_image = False
        user_content = []
        
        if isinstance(contents, str):
            user_content.append({"type": "text", "text": contents})
        elif isinstance(contents, (list, tuple)):
            for item in contents:
                if isinstance(item, str):
                    user_content.append({"type": "text", "text": item})
                elif hasattr(item, "inline_data") and item.inline_data:
                    mime_type = getattr(item.inline_data, "mime_type", "image/png")
                    data = getattr(item.inline_data, "data", b"")
                    if isinstance(data, str):
                        base64_data = data
                    else:
                        base64_data = base64.b64encode(data).decode("utf-8")
                    user_content.append({
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime_type};base64,{base64_data}"}
                    })
                    has_image = True
                    
        messages.append({"role": "user", "content": user_content})
        
        if not model or "gemini" in model:
            model_to_use = get_model_id(has_image)
        else:
            model_to_use = model
            
        payload = {
            "model": model_to_use,
            "messages": messages,
        }
        if response_mime_type == "application/json":
            payload["response_format"] = {"type": "json_object"}
        if temperature is not None:
            payload["temperature"] = temperature
            
        logger.info("Calling NVIDIA API model=%s (sync)", model_to_use)
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            result_json = resp.json()
            
        text = result_json["choices"][0]["message"]["content"]
        
        parsed = None
        if response_schema:
            cleaned_text = clean_json_text(text)
            parsed = response_schema.model_validate_json(cleaned_text)
            
        return MockGenerateContentResponse(text=text, parsed=parsed)


class NvidiaClient:
    def __init__(self, api_key: str):
        self.models = NvidiaModels(api_key)


def get_llm_client() -> NvidiaClient:
    """Return a configured NvidiaClient."""
    return NvidiaClient(api_key=get_api_key())


def is_retryable_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return (
        "503" in message
        or "unavailable" in message
        or "rate limit" in message
        or "429" in message
        or "timeout" in message
    )


async def generate_content_with_retry(
    *,
    client: NvidiaClient,
    contents,
    config=None,
) -> MockGenerateContentResponse:
    """Call NVIDIA API with exponential backoff on transient errors."""
    has_image = False
    if isinstance(contents, (list, tuple)):
        for item in contents:
            if hasattr(item, "inline_data") and item.inline_data:
                has_image = True
                break
    model_id = get_model_id(has_image)
    last_exc: Exception | None = None

    for attempt, delay in enumerate((0.0, *LLM_RETRY_DELAYS), start=1):
        if delay:
            await asyncio.sleep(delay + random.uniform(0, delay * 0.25))
        try:
            return await asyncio.to_thread(
                client.models.generate_content,
                model=model_id,
                contents=contents,
                config=config,
            )
        except Exception as exc:
            last_exc = exc
            if not is_retryable_error(exc):
                raise
            logger.warning(
                "NVIDIA API transient error (attempt %d/%d): %s",
                attempt,
                len(LLM_RETRY_DELAYS) + 1,
                exc,
            )

    raise RuntimeError(f"NVIDIA API unavailable after {len(LLM_RETRY_DELAYS) + 1} attempts") from last_exc


class MockInlineData:
    def __init__(self, data: bytes, mime_type: str):
        self.data = data
        self.mime_type = mime_type


class MockPart:
    def __init__(self, data: bytes, mime_type: str):
        self.inline_data = MockInlineData(data, mime_type)


class Part:
    @staticmethod
    def from_bytes(data: bytes, mime_type: str) -> MockPart:
        return MockPart(data, mime_type)


class GenerateContentConfig:
    def __init__(
        self,
        system_instruction: str | None = None,
        response_mime_type: str | None = None,
        response_schema = None,
        temperature: float | None = None,
        top_p: float | None = None,
    ):
        self.system_instruction = system_instruction
        self.response_mime_type = response_mime_type
        self.response_schema = response_schema
        self.temperature = temperature
        self.top_p = top_p
