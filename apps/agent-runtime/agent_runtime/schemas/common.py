from pydantic import BaseModel, Field
from typing import Optional, Any, Dict, List
from datetime import datetime


class SimilarCase(BaseModel):
    item_id: str
    similarity_score: float
    annotation_result: Dict[str, Any]
    review_decision: str
    review_comment: str


class ConflictExplanation(BaseModel):
    conflict_id: str
    explanation: str
    possible_reasons: List[str]
    resolution_suggestions: List[str]


class LabelerLoadInfo(BaseModel):
    labeler_id: str
    active_items: int
    completed_today: int
    avg_seconds_per_item: float
    recommended_quota: int


class SlaAlert(BaseModel):
    assignment_id: str
    labeler_id: str
    status: str
    minutes_overdue: int
    alert_level: str


class AssignmentSuggestion(BaseModel):
    recommended_labeler_ids: List[str]
    sla_alerts: List[SlaAlert]
    metadata: Dict[str, Any]
