-- Trace completeness metadata on agent runs
ALTER TABLE agent_runs
  ADD COLUMN trace_completeness BOOLEAN NULL DEFAULT NULL,
  ADD COLUMN missing_nodes_json JSON NULL;
