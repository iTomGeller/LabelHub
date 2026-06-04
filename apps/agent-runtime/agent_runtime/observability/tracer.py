import uuid
import contextvars
from typing import Optional, Generator
from contextlib import contextmanager

_trace_id_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "trace_id", default=None
)


def generate_trace_id() -> str:
    """生成标准traceId"""
    return str(uuid.uuid4())


def set_current_trace_id(trace_id: str) -> None:
    """设置当前上下文中的traceId"""
    _trace_id_var.set(trace_id)


def get_current_trace_id() -> Optional[str]:
    """获取当前上下文中的traceId"""
    return _trace_id_var.get()


@contextmanager
def trace_context(trace_id: Optional[str] = None) -> Generator[str, None, None]:
    """
    上下文管理器，用于创建和传递traceId
    
    使用示例:
        with trace_context() as trace_id:
            # 在这个上下文中，get_current_trace_id() 返回同一个trace_id
            result = await some_agent.execute()
    """
    new_trace_id = trace_id if trace_id is not None else generate_trace_id()
    token = _trace_id_var.set(new_trace_id)
    try:
        yield new_trace_id
    finally:
        _trace_id_var.reset(token)


class TraceContext:
    """Trace上下文封装类"""
    
    def __init__(self, trace_id: Optional[str] = None):
        self.trace_id = trace_id if trace_id is not None else generate_trace_id()
        self._token = None
    
    def __enter__(self):
        self._token = _trace_id_var.set(self.trace_id)
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._token is not None:
            _trace_id_var.reset(self._token)
        return False
