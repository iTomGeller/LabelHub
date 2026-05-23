---
name: instruction-refine
version: 0.1.0
description: Refine owner task instructions into labeler-ready instructions.
---

# Instruction Refine Skill

InstructionRefineAgent improves ambiguous task instructions before publish.

## Checks

- Missing task goal.
- Ambiguous category boundaries.
- Missing positive and negative examples.
- No guidance for edge cases.
- Conflicting wording between instruction and Rubric.

## Output

Return:

- `improvedInstruction`
- `ambiguities`
- `recommendedExamples`
- `traceId`
