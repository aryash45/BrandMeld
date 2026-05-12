"""
integrations/mailgun_client.py — Email delivery via Mailgun REST API.
Used for: weekly prompts, engagement reports, voice consistency emails.
"""
from __future__ import annotations
import logging
from typing import Optional
import httpx
from app.config import get_settings

logger = logging.getLogger(__name__)

_MAILGUN_BASE = "https://api.mailgun.net/v3"


class MailgunClient:
    def __init__(self):
        self.settings = get_settings()
        self._auth = ("api", self.settings.mailgun_api_key)
        self._base = f"{_MAILGUN_BASE}/{self.settings.mailgun_domain}"

    async def send(
        self,
        to: str,
        subject: str,
        html: str,
        text: Optional[str] = None,
        tags: Optional[list[str]] = None,
    ) -> dict:
        """Send an email. Returns Mailgun response dict."""
        if not self.settings.mailgun_api_key or not self.settings.mailgun_domain:
            logger.warning("Mailgun not configured — email not sent to %s", to)
            return {"status": "skipped", "reason": "not_configured"}

        data: dict = {
            "from": self.settings.mailgun_from,
            "to": to,
            "subject": subject,
            "html": html,
        }
        if text:
            data["text"] = text
        if tags:
            data["o:tag"] = tags

        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"{self._base}/messages",
                auth=self._auth,
                data=data,
            )
            r.raise_for_status()
            return r.json()

    async def send_weekly_prompt(
        self, to: str, user_name: str, prompt_text: str, answer_url: str
    ) -> dict:
        subject = f"BrandMeld Weekly: {prompt_text[:60]}..."
        html = _WEEKLY_PROMPT_TEMPLATE.format(
            name=user_name or "there",
            prompt=prompt_text,
            cta_url=answer_url,
        )
        return await self.send(
            to=to, subject=subject, html=html, tags=["weekly_prompt"]
        )

    async def send_engagement_report(
        self, to: str, user_name: str, stats: dict
    ) -> dict:
        subject = "Your BrandMeld Weekly Performance Report"
        html = _ENGAGEMENT_REPORT_TEMPLATE.format(
            name=user_name or "there",
            posts=stats.get("posts_published", 0),
            likes=stats.get("total_likes", 0),
            impressions=stats.get("total_impressions", 0),
            engagement=stats.get("avg_engagement_rate", 0),
        )
        return await self.send(
            to=to, subject=subject, html=html, tags=["engagement_report"]
        )


# ── Email Templates (inline HTML, keep simple) ────────────────────────────


_WEEKLY_PROMPT_TEMPLATE = """\
<!DOCTYPE html>
<html>
<body style="background:#0a0a0a;color:#fff;font-family:'Space Grotesk',Arial,sans-serif;padding:40px 20px;">
  <div style="max-width:560px;margin:0 auto;">
    <p style="color:#EAFF00;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:0 0 32px;">
      BrandMeld Weekly
    </p>
    <h1 style="font-size:28px;font-weight:900;text-transform:uppercase;margin:0 0 16px;">
      Time to share something.
    </h1>
    <p style="color:rgba(255,255,255,0.7);font-size:16px;line-height:1.6;margin:0 0 24px;">
      Hey {name}, your weekly prompt is ready:
    </p>
    <div style="border:2px solid #EAFF00;padding:20px 24px;margin:0 0 32px;">
      <p style="font-size:18px;font-weight:600;margin:0;">"{prompt}"</p>
    </div>
    <a href="{cta_url}"
       style="background:#EAFF00;color:#000;padding:14px 28px;font-weight:900;
              text-transform:uppercase;text-decoration:none;font-size:13px;
              letter-spacing:2px;display:inline-block;">
      Answer &amp; Generate →
    </a>
    <p style="color:rgba(255,255,255,0.35);font-size:12px;margin:40px 0 0;">
      You're receiving this because weekly prompts are enabled.
      <a href="{cta_url}/settings/preferences" style="color:rgba(255,255,255,0.5);">Unsubscribe</a>
    </p>
  </div>
</body>
</html>
"""

_ENGAGEMENT_REPORT_TEMPLATE = """\
<!DOCTYPE html>
<html>
<body style="background:#0a0a0a;color:#fff;font-family:'Space Grotesk',Arial,sans-serif;padding:40px 20px;">
  <div style="max-width:560px;margin:0 auto;">
    <p style="color:#00F0FF;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:0 0 32px;">
      BrandMeld Performance
    </p>
    <h1 style="font-size:28px;font-weight:900;text-transform:uppercase;margin:0 0 24px;">
      Your week in numbers.
    </h1>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:0 0 32px;">
      <div style="border:1px solid rgba(255,255,255,0.2);padding:16px;">
        <p style="color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px;">Posts Published</p>
        <p style="font-size:32px;font-weight:900;margin:0;">{posts}</p>
      </div>
      <div style="border:1px solid rgba(255,255,255,0.2);padding:16px;">
        <p style="color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px;">Total Likes</p>
        <p style="font-size:32px;font-weight:900;margin:0;">{likes}</p>
      </div>
      <div style="border:1px solid rgba(255,255,255,0.2);padding:16px;">
        <p style="color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px;">Impressions</p>
        <p style="font-size:32px;font-weight:900;margin:0;">{impressions}</p>
      </div>
      <div style="border:1px solid rgba(255,255,255,0.2);padding:16px;">
        <p style="color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px;">Engagement Rate</p>
        <p style="font-size:32px;font-weight:900;margin:0;">{engagement:.1f}%</p>
      </div>
    </div>
    <p style="color:rgba(255,255,255,0.5);font-size:13px;">Keep it up, {name}.</p>
  </div>
</body>
</html>
"""
