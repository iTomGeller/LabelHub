---
name: dataset-profile
version: 0.2.0
description: Profile imported data before task publishing.
triggers:
  - dataset_sampler
  - data_quality_check
outputSchema:
  - dataFindings
  - fieldStats
  - warnings
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
