import time
from typing import Dict, Any
from langgraph.graph import StateGraph, END
from .state import ReviewAssistAgentState
from ..mcp import McpBClient, get_mcp_client
from ..observability import AgentRunRecorder
from ..observability.tracer import get_current_trace_id, generate_trace_id, trace_context


async def lookup_similar_cases_node(state: ReviewAssistAgentState) -> Dict[str, Any]:
    """调用MCP工具检索相似历史标注"""
    mcp_client: McpBClient = get_mcp_client()
    start_ns = time.time_ns()
    
    try:
        similar_cases = await mcp_client.a_lookup_similar(
            state["task_id"], state["annotation_result"]
        )
        latency_ms = int((time.time_ns() - start_ns) / 1_000_000)
        
        return {
            "similar_cases": [sc.model_dump() for sc in similar_cases],
            "tool_calls": [{"name": "annotation.lookupSimilar", "latencyMs": latency_ms}],
            "context_refs": {
                "similarCaseCount": len(similar_cases),
                "source": "mcp.annotation.lookupSimilar"
            }
        }
    except Exception as e:
        return {
            "similar_cases": [],
            "tool_calls": [],
            "context_refs": {"error": str(e)}
        }


async def generate_review_output_node(state: ReviewAssistAgentState) -> Dict[str, Any]:
    """生成审核辅助输出"""
    output = {
        "taskId": state["task_id"],
        "itemId": state["item_id"],
        "similarCases": state.get("similar_cases", []),
        "conflictExplanation": None,
        "riskTags": ["normal"],
        "metadata": {
            "generatedAt": "now",
            "similarCaseCount": len(state.get("similar_cases", []))
        }
    }
    
    return {
        "review_assist_output": output
    }


async def finalize_review_assist_node(state: ReviewAssistAgentState) -> Dict[str, Any]:
    """完成Agent运行记录"""
    recorder = AgentRunRecorder()
    trace_id = get_current_trace_id() or state.get("trace_id", generate_trace_id())
    
    await recorder.finalize_and_submit(
        agent_name="ReviewAssistAgent",
        skill_name=state["skill_name"],
        skill_version=state["skill_version"],
        task_id=state["task_id"],
        item_id=state.get("item_id"),
        input_summary=f"taskId={state['task_id']}, itemId={state['item_id']}",
        output_summary=f"similarCases={len(state.get('similar_cases', []))}",
        context_refs=state.get("context_refs", {}),
        status="COMPLETED",
    )
    
    return {}


def build_review_assist_agent_graph():
    """构建Review Assist Agent的LangGraph DAG"""
    workflow = StateGraph(ReviewAssistAgentState)
    
    workflow.add_node("lookup_similar", lookup_similar_cases_node)
    workflow.add_node("generate_output", generate_review_output_node)
    workflow.add_node("finalize", finalize_review_assist_node)
    
    workflow.set_entry_point("lookup_similar")
    workflow.add_edge("lookup_similar", "generate_output")
    workflow.add_edge("generate_output", "finalize")
    workflow.add_edge("finalize", END)
    
    return workflow.compile()


class ReviewAssistAgent:
    """ReviewAssistAgent - 人工审核辅助Agent
    
    成员B Agent边界：
    - 检索相似历史案例
    - 生成冲突解释
    - 给出风险提示
    - 不直接决定最终通过或退回
    """
    
    def __init__(self):
        self.graph = build_review_assist_agent_graph()
    
    async def execute(
        self, 
        task_id: str, 
        item_id: str, 
        annotation_result: Dict[str, Any],
        skill_version: str = "1.0"
    ) -> Dict[str, Any]:
        trace_id = generate_trace_id()
        
        with trace_context(trace_id):
            initial_state: ReviewAssistAgentState = {
                "task_id": task_id,
                "item_id": item_id,
                "trace_id": trace_id,
                "skill_name": "review-assist",
                "skill_version": skill_version,
                "annotation_result": annotation_result,
                "similar_cases": [],
                "review_assist_output": None,
                "context_refs": {},
                "tool_calls": []
            }
            
            result = await self.graph.ainvoke(initial_state)
            return {
                "traceId": trace_id,
                "reviewAssistOutput": result.get("review_assist_output")
            }
