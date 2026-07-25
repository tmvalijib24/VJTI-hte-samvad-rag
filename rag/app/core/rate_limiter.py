"""Rate limiting configuration using slowapi."""

from slowapi import Limiter
from slowapi.util import get_remote_address
from typing import Optional
from fastapi import Request


def get_user_id_from_request(request: Request) -> str:
    """Extract user_id from JWT token in request headers for rate limiting key."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        # Return a hash of the token as the rate limit key
        # This ensures one JWT token = one rate limit bucket
        token = auth_header[7:]
        return f"user_{hash(token) % (10 ** 8)}"
    
    # Fallback to IP-based limiting if no auth token
    return f"ip_{get_remote_address(request)}"


# Initialize limiter with user_id as the key function
limiter = Limiter(
    key_func=get_user_id_from_request,
    default_limits=["200/day"],  # Global fallback limit
)

# Define specific rate limit configs
RATE_LIMIT_ASK = "20/minute"  # /ask: 20 requests/minute per user
RATE_LIMIT_INGEST = "5/minute"  # /ingest/url and /ingest/file: 5 requests/minute per user
RATE_LIMIT_CHAT = "30/minute"  # /chat/basic: 30 requests/minute per user
