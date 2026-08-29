"""
integrations/slack_bot.py — Slack bot interface. [STUB — Feature 2]

Will receive Slack commands and surface generated content for approval.

Planned commands:
    /brandmeld generate <topic>   — generate content for review
    /brandmeld approve <id>       — approve and queue for posting
    /brandmeld reject <id>        — reject and optionally regenerate

TODO (Feature 2):
    - Set up Slack App with slash commands + interactive components
    - Add SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET to .env
    - Implement webhook handler (FastAPI route in app/main.py)
    - Wire generate_content() output into Slack blocks
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def handle_generate_command(user_id: str, topic: str) -> dict:
    """Stub: handle /brandmeld generate <topic>"""
    raise NotImplementedError("Slack bot not yet implemented (Feature 2)")


def handle_approval_callback(payload: dict) -> dict:
    """Stub: handle block_actions approval/rejection callbacks"""
    raise NotImplementedError("Slack bot not yet implemented (Feature 2)")
