from pydantic import BaseModel, Field
from typing import Any, Dict, List


class SkillDefinition(BaseModel):
    name: str = Field(..., description="Skill唯一名称")
    version: str = Field(..., description="SemVer格式版本号，如1.0.0")
    description: str = Field(..., description="Skill描述")
    input_schema: Dict[str, Any] = Field(..., description="输入JSON Schema")
    output_schema: Dict[str, Any] = Field(..., description="输出JSON Schema")
    examples: List[Dict[str, Any]] = Field(default_factory=list, description="示例列表")
