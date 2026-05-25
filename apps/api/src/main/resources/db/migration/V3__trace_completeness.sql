-- Ensure trace-scoped node uniqueness and completeness metadata on runs
ALTER TABLE business_nodes
  ADD UNIQUE KEY uk_business_trace_node (trace_id, node_key);

ALTER TABLE trace_nodes
  ADD UNIQUE KEY uk_trace_trace_node (trace_id, id);

ALTER TABLE agent_runs
  ADD COLUMN trace_completeness BOOLEAN NULL DEFAULT NULL AFTER from_cache,
  ADD COLUMN missing_nodes_json JSON NULL AFTER trace_completeness;
