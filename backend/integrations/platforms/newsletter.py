"""
integrations/platforms/newsletter.py — Newsletter delivery. [STUB — Feature 4]

TODO:
    - Beehiiv API (BEEHIIV_API_KEY, BEEHIIV_PUBLICATION_ID in config.py)
    - POST /v2/publications/{id}/posts to create a draft
    - Optionally Mailgun for one-off sends (MAILGUN_API_KEY in config.py)
"""
from __future__ import annotations


async def create_draft(api_key: str, publication_id: str, content: str, subject: str) -> dict:
    """Stub: create a newsletter draft in Beehiiv."""
    raise NotImplementedError("Newsletter integration not yet implemented (Feature 4)")
