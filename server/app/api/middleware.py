"""API middleware."""
from fastapi import Request


async def request_logging_middleware(request: Request, call_next):
    """Placeholder middleware for request logging."""
    response = await call_next(request)
    return response
