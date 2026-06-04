"""
LabelHub Agent Runtime - Member B Production Collaboration Agents
"""
import asyncio
import sys
from .agents import AssignmentAgent, ReviewAssistAgent


async def demo_assignment_agent():
    """演示Assignment Agent的运行"""
    print("[AssignmentAgent] 开始执行任务分发建议...")
    agent = AssignmentAgent()
    result = await agent.execute(task_id="demo-task-001", skill_version="1.0")
    print(f"[AssignmentAgent] 完成，traceId={result['traceId']}")
    return result


async def demo_review_assist_agent():
    """演示Review Assist Agent的运行"""
    print("[ReviewAssistAgent] 开始执行审核辅助...")
    agent = ReviewAssistAgent()
    result = await agent.execute(
        task_id="demo-task-001",
        item_id="demo-item-001",
        annotation_result={"label": "positive", "confidence": 0.9},
        skill_version="1.0"
    )
    print(f"[ReviewAssistAgent] 完成，traceId={result['traceId']}")
    return result


async def main():
    """主入口函数"""
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        if cmd == "demo":
            await demo_assignment_agent()
            await demo_review_assist_agent()
        else:
            print(f"未知命令: {cmd}")
    else:
        print("LabelHub Agent Runtime (Member B) - Production Collaboration Agents")
        print("用法: python -m agent_runtime.main demo")


if __name__ == "__main__":
    asyncio.run(main())
