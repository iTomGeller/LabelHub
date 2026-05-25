-- Ensure trace-scoped node uniqueness (run after V4 repair)
ALTER TABLE business_nodes
  ADD UNIQUE KEY uk_business_trace_node (trace_id, node_key);

ALTER TABLE trace_nodes
  ADD UNIQUE KEY uk_trace_trace_node (trace_id, id);
