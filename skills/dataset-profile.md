---
name: dataset-profile
version: 0.1.0
description: Profile imported data before task publishing.
---

# Dataset Profile Skill

DatasetProfileAgent samples imported data and reports risks before publishing.

## Required Findings

- Empty fields.
- Duplicate estimate.
- Abnormal length.
- Inconsistent field type.
- Missing media references.
- Fields not mapped into Schema display paths.

## Output

Return:

- `sampleSize`
- `fieldStats`
- `warnings`
- `recommendedMappings`
- `traceId`
