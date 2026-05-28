-- Member B: Agent Run, Agent Result tables for production协同类 Agent
CREATE TABLE IF NOT EXISTS agent_run (
    id VARCHAR(36) PRIMARY KEY,
    agent_name VARCHAR(255) NOT NULL,
    skill_name VARCHAR(255) NOT NULL,
    skill_version VARCHAR(50) NOT NULL,
    task_id VARCHAR(255) NOT NULL,
    item_id VARCHAR(36),
    trace_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    input_summary TEXT,
    output_summary TEXT,
    context_refs_json TEXT,
    tool_calls_json TEXT,
    llm_calls_json TEXT,
    latency_ms BIGINT,
    queue_wait_ms BIGINT,
    error_code VARCHAR(100),
    error_message TEXT,
    created_at DATETIME NOT NULL,
    completed_at DATETIME,
    INDEX idx_task_item (task_id, item_id),
    INDEX idx_trace_id (trace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agent_result (
    id VARCHAR(36) PRIMARY KEY,
    agent_run_id VARCHAR(36) NOT NULL,
    task_id VARCHAR(255) NOT NULL,
    item_id VARCHAR(36) NOT NULL,
    result_type VARCHAR(100) NOT NULL,
    suggestion TEXT,
    confidence DOUBLE NOT NULL,
    evidence_json TEXT,
    metadata_json TEXT,
    status VARCHAR(50) NOT NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_task_item (task_id, item_id),
    INDEX idx_agent_run (agent_run_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
