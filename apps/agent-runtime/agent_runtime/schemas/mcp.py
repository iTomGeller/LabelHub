from pydantic import BaseModel, Field
from typing import Optional, Generic, TypeVar, Any

T = TypeVar("T")


class McpError(BaseModel):
    error_code: str
    message: str
    retryable: bool


class McpResponse(BaseModel, Generic[T]):
    ok: bool
    data: Optional[T]
    error: Optional[McpError]
    trace_id: str
    latency_ms: int
