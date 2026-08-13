import os

from slowapi import Limiter
from slowapi.util import get_remote_address


def rate_limit_key(request) -> str:
    return str(getattr(request.state, "user_id", None) or get_remote_address(request))


limiter = Limiter(
    key_func=rate_limit_key,
    storage_uri=os.getenv("RATE_LIMIT_STORAGE_URI", "memory://"),
)
