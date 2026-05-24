-- Agent Run: stores each audit execution with cache support
CREATE TABLE agent_runs (
  trace_id VARCHAR(128) PRIMARY KEY,
  task_id VARCHAR(64) NOT NULL,
  config_hash VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'running',
  from_cache BOOLEAN NOT NULL DEFAULT FALSE,
  result_json JSON,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP NULL,
  INDEX idx_agent_runs_task_hash (task_id, config_hash),
  INDEX idx_agent_runs_status (status)
);

-- Business DAG nodes: human-readable audit dimensions
CREATE TABLE business_nodes (
  id VARCHAR(64) PRIMARY KEY,
  trace_id VARCHAR(128) NOT NULL,
  node_key VARCHAR(64) NOT NULL,
  title VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL,
  summary TEXT,
  evidence TEXT,
  impact TEXT,
  suggestion TEXT,
  reference_sources TEXT,
  fix_step VARCHAR(32),
  duration_ms BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_business_nodes_trace (trace_id)
);

-- Developer trace nodes: full agent execution detail
CREATE TABLE trace_nodes (
  id VARCHAR(64) PRIMARY KEY,
  trace_id VARCHAR(128) NOT NULL,
  parent_id VARCHAR(64),
  node_type VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL,
  duration_ms BIGINT NOT NULL DEFAULT 0,
  input_preview JSON,
  output_preview JSON,
  prompt_json JSON,
  rag_json JSON,
  skill_json JSON,
  mcp_json JSON,
  sandbox_json JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_trace_nodes_trace (trace_id),
  INDEX idx_trace_nodes_type (node_type)
);

-- Knowledge base documents
CREATE TABLE knowledge_documents (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(64) NOT NULL,
  source_type VARCHAR(32) NOT NULL DEFAULT 'upload',
  content MEDIUMTEXT NOT NULL,
  chunk_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_knowledge_category (category)
);

-- Knowledge chunks for retrieval
CREATE TABLE knowledge_chunks (
  id VARCHAR(64) PRIMARY KEY,
  document_id VARCHAR(64) NOT NULL,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  keywords TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_chunks_doc (document_id)
);

-- Skill registry metadata
CREATE TABLE skill_registry (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL UNIQUE,
  version VARCHAR(32) NOT NULL DEFAULT '0.1.0',
  description TEXT,
  triggers_json JSON,
  output_schema_json JSON,
  file_path VARCHAR(512),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- MCP call logs
CREATE TABLE mcp_call_logs (
  id VARCHAR(64) PRIMARY KEY,
  trace_id VARCHAR(128) NOT NULL,
  server_name VARCHAR(128) NOT NULL,
  tool_name VARCHAR(128) NOT NULL,
  input_json JSON,
  output_json JSON,
  status VARCHAR(32) NOT NULL,
  duration_ms BIGINT NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_mcp_trace (trace_id)
);

-- Sandbox execution logs
CREATE TABLE sandbox_executions (
  id VARCHAR(64) PRIMARY KEY,
  trace_id VARCHAR(128) NOT NULL,
  tool_name VARCHAR(128) NOT NULL,
  input_json JSON,
  output_json JSON,
  exit_code INT NOT NULL DEFAULT 0,
  stdout TEXT,
  stderr TEXT,
  duration_ms BIGINT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sandbox_trace (trace_id)
);
