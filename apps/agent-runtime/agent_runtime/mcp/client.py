import httpx
import uuid
from typing import Optional, Any, Dict, List
from pydantic import TypeAdapter
from ..schemas.mcp import McpResponse
from ..schemas.common import SimilarCase, AssignmentSuggestion
from ..observability.tracer import get_current_trace_id


class McpBClient:
    def __init__(self, base_url: str = "http://localhost:8080/api/v1/mcp/b"):
        self.base_url = base_url
        self._client: Optional[httpx.Client] = None

    def _get_client(self) -> httpx.Client:
        if self._client is None:
            self._client = httpx.Client(timeout=10.0)
        return self._client

    def _get_trace_headers(self) -> Dict[str, str]:
        trace_id = get_current_trace_id()
        return {"X-Trace-ID": trace_id} if trace_id else {}

    async def a_get_submitted(self, task_id: str) -> List[Dict[str, Any]]:
        """annotation.getSubmitted - 获取已提交的标注条目"""
        client = self._get_client()
        resp = client.get(
            f"{self.base_url}/annotation.getSubmitted",
            params={"taskId": task_id},
            headers=self._get_trace_headers()
        )
        resp.raise_for_status()
        mcp_resp = McpResponse[List[Dict[str, Any]]].model_validate(resp.json())
        if not mcp_resp.ok or mcp_resp.data is None:
            raise RuntimeError(f"MCP call failed: {mcp_resp.error}")
        return mcp_resp.data

    async def a_lookup_similar(
        self, task_id: str, annotation_result: Dict[str, Any]
    ) -> List[SimilarCase]:
        """annotation.lookupSimilar - 检索相似历史标注"""
        client = self._get_client()
        resp = client.post(
            f"{self.base_url}/annotation.lookupSimilar",
            json={"taskId": task_id, "annotationResult": annotation_result},
            headers=self._get_trace_headers()
        )
        resp.raise_for_status()
        mcp_resp = McpResponse[List[SimilarCase]].model_validate(resp.json())
        if not mcp_resp.ok or mcp_resp.data is None:
            raise RuntimeError(f"MCP call failed: {mcp_resp.error}")
        return mcp_resp.data

    async def a_get_review_history(
        self, task_id: str, item_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """review.getHistory - 获取审核历史记录"""
        client = self._get_client()
        params = {"taskId": task_id}
        if item_id:
            params["itemId"] = item_id
        resp = client.get(
            f"{self.base_url}/review.getHistory",
            params=params,
            headers=self._get_trace_headers()
        )
        resp.raise_for_status()
        mcp_resp = McpResponse[List[Dict[str, Any]]].model_validate(resp.json())
        if not mcp_resp.ok or mcp_resp.data is None:
            raise RuntimeError(f"MCP call failed: {mcp_resp.error}")
        return mcp_resp.data

    async def a_get_audit_trail(self, task_id: str, item_id: str) -> List[Dict[str, Any]]:
        """workflow.getAuditTrail - 获取工作流审计轨迹"""
        client = self._get_client()
        resp = client.get(
            f"{self.base_url}/workflow.getAuditTrail",
            params={"taskId": task_id, "itemId": item_id},
            headers=self._get_trace_headers()
        )
        resp.raise_for_status()
        mcp_resp = McpResponse[List[Dict[str, Any]]].model_validate(resp.json())
        if not mcp_resp.ok or mcp_resp.data is None:
            raise RuntimeError(f"MCP call failed: {mcp_resp.error}")
        return mcp_resp.data

    async def a_get_assignment_load(self, task_id: str) -> AssignmentSuggestion:
        """assignment.getLoad - 获取人员负载和分配建议"""
        client = self._get_client()
        resp = client.get(
            f"{self.base_url}/assignment.getLoad",
            params={"taskId": task_id},
            headers=self._get_trace_headers()
        )
        resp.raise_for_status()
        mcp_resp = McpResponse[AssignmentSuggestion].model_validate(resp.json())
        if not mcp_resp.ok or mcp_resp.data is None:
            raise RuntimeError(f"MCP call failed: {mcp_resp.error}")
        return mcp_resp.data

    async def a_get_agent_results(
        self, task_id: str, item_id: str
    ) -> List[Dict[str, Any]]:
        """agent.getResults - 获取Agent结果"""
        client = self._get_client()
        resp = client.get(
            f"{self.base_url}/agent.getResults",
            params={"taskId": task_id, "itemId": item_id},
            headers=self._get_trace_headers()
        )
        resp.raise_for_status()
        mcp_resp = McpResponse[List[Dict[str, Any]]].model_validate(resp.json())
        if not mcp_resp.ok or mcp_resp.data is None:
            raise RuntimeError(f"MCP call failed: {mcp_resp.error}")
        return mcp_resp.data

    async def a_get_agent_run(self, trace_id: str) -> Optional[Dict[str, Any]]:
        """agent.getRun - 查询Agent运行记录"""
        client = self._get_client()
        resp = client.get(
            f"{self.base_url}/agent.getRun",
            params={"traceId": trace_id},
            headers=self._get_trace_headers()
        )
        resp.raise_for_status()
        mcp_resp = McpResponse[Optional[Dict[str, Any]]].model_validate(resp.json())
        if not mcp_resp.ok:
            raise RuntimeError(f"MCP call failed: {mcp_resp.error}")
        return mcp_resp.data

    def close(self):
        if self._client:
            self._client.close()
            self._client = None


_global_mcp_client: Optional[McpBClient] = None


def get_mcp_client() -> McpBClient:
    global _global_mcp_client
    if _global_mcp_client is None:
        _global_mcp_client = McpBClient()
    return _global_mcp_client
