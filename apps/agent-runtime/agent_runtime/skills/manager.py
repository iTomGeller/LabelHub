import os
import json
from pathlib import Path
from typing import Dict, Optional
from .base import SkillDefinition


class SkillManager:
    """可版本化Skill管理器 - 确保所有Agent加载对应版本的Skill"""
    
    def __init__(self, skills_dir: Optional[str] = None):
        if skills_dir is None:
            current_dir = Path(__file__).parent.parent.parent.parent
            skills_dir = str(current_dir / "skills")
        self.skills_dir = Path(skills_dir)
        self._skills_cache: Dict[str, Dict[str, SkillDefinition]] = {}
        self._load_all_skills()
    
    def _load_all_skills(self):
        """从skills目录加载所有Skill定义"""
        if not self.skills_dir.exists():
            self.skills_dir.mkdir(parents=True, exist_ok=True)
            return
        
        for skill_file in self.skills_dir.glob("*.md"):
            name = skill_file.stem
            definition_file = self.skills_dir / f"{name}.json"
            if definition_file.exists():
                with open(definition_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    skill = SkillDefinition.model_validate(data)
                    if name not in self._skills_cache:
                        self._skills_cache[name] = {}
                    self._skills_cache[name][skill.version] = skill
    
    def get_skill(self, name: str, version: str) -> Optional[SkillDefinition]:
        """获取指定名称和版本的Skill"""
        if name not in self._skills_cache:
            return None
        return self._skills_cache[name].get(version)
    
    def get_latest_version(self, name: str) -> Optional[str]:
        """获取Skill的最新版本号"""
        if name not in self._skills_cache or not self._skills_cache[name]:
            return None
        versions = list(self._skills_cache[name].keys())
        versions.sort()
        return versions[-1]
    
    def register_skill(self, skill: SkillDefinition):
        """注册新的Skill版本（不覆盖旧版本）"""
        if skill.name not in self._skills_cache:
            self._skills_cache[skill.name] = {}
        self._skills_cache[skill.name][skill.version] = skill
        
        definition_file = self.skills_dir / f"{skill.name}.json"
        if not definition_file.exists():
            with open(definition_file, "w", encoding="utf-8") as f:
                json.dump(skill.model_dump(), f, indent=2, ensure_ascii=False)


_global_skill_manager: Optional[SkillManager] = None


def get_skill_manager() -> SkillManager:
    global _global_skill_manager
    if _global_skill_manager is None:
        _global_skill_manager = SkillManager()
    return _global_skill_manager
