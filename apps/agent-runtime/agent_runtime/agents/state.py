from typing import Annotated, TypedDict, Optional, Any, Dict, List
from langgraph.graph.message import add_messages


class AssignmentAgentState(TypedDict):
    task_id: str
    trace_id: str
    skill_name: str
    skill_version: str
    assignment_suggestion: Optional[Dict[str, Any]]
    context_refs: Dict[str, Any]
    tool_calls: List[Dict[str, Any]]


class ReviewAssistAgentState(TypedDict):
    task_id: str
    item_id: str
    trace_id: str
    skill_name: str
    skill_version: str
    annotation_result: Dict[str, Any]
    similar_cases: List[Any]
    review_assist_output: Optional[Dict[str, Any]]
    context_refs: Dict[str, Any]
    tool_calls: List[Dict[str, Any]]
