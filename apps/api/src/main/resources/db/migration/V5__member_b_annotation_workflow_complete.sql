-- Member B: All workflow &amp; annotation tables (full set including annotation_item)
-- Merged into Member A's existing migration sequence (after V4)
CREATE TABLE IF NOT EXISTS annotation_item (
    id VARCHAR(36) PRIMARY KEY,
    task_id VARCHAR(255) NOT NULL,
    data_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    current_labeler_id VARCHAR(255),
    current_reviewer_id VARCHAR(255),
    annotation_result JSON,
    draft JSON,
    ai_review_result JSON,
    review_comment VARCHAR(2000),
    review_round INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_task_status (task_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assignments (
    id VARCHAR(36) PRIMARY KEY,
    task_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL,
    items_assigned INT NOT NULL DEFAULT 0,
    items_completed INT NOT NULL DEFAULT 0,
    quota INT NOT NULL DEFAULT 10,
    started_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_task_user (task_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS annotations (
    id VARCHAR(36) PRIMARY KEY,
    item_id VARCHAR(36) NOT NULL,
    labeler_id VARCHAR(255) NOT NULL,
    result_json JSON NOT NULL,
    annotation_duration_ms BIGINT,
    schema_version_id VARCHAR(255),
    created_at DATETIME NOT NULL,
    INDEX idx_item (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS annotation_drafts (
    id VARCHAR(36) PRIMARY KEY,
    item_id VARCHAR(36) NOT NULL,
    labeler_id VARCHAR(255) NOT NULL,
    draft_json JSON NOT NULL,
    saved_at DATETIME NOT NULL,
    INDEX idx_item_labeler (item_id, labeler_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reviews (
    id VARCHAR(36) PRIMARY KEY,
    task_id VARCHAR(255) NOT NULL,
    item_id VARCHAR(36) NOT NULL,
    reviewer_id VARCHAR(255) NOT NULL,
    decision VARCHAR(30) NOT NULL,
    comment VARCHAR(2000),
    field_level_differences JSON,
    reviewed_at DATETIME NOT NULL,
    INDEX idx_item (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS review_decisions (
    id VARCHAR(36) PRIMARY KEY,
    review_id VARCHAR(36) NOT NULL,
    decision_type VARCHAR(30) NOT NULL,
    decision_detail JSON,
    created_at DATETIME NOT NULL,
    INDEX idx_review (review_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS workflow_events (
    event_id VARCHAR(36) PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    task_id VARCHAR(255) NOT NULL,
    item_id VARCHAR(36) NOT NULL,
    actor_id VARCHAR(255) NOT NULL,
    actor_type VARCHAR(20) NOT NULL,
    payload JSON,
    trace_id VARCHAR(255),
    timestamp DATETIME NOT NULL,
    INDEX idx_task_item (task_id, item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS workflow_audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    event_id VARCHAR(36) NOT NULL,
    operator VARCHAR(255) NOT NULL,
    ip_address VARCHAR(50),
    user_agent TEXT,
    action_detail JSON,
    occurred_at DATETIME NOT NULL,
    INDEX idx_event (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS review_conflicts (
    id VARCHAR(36) PRIMARY KEY,
    task_id VARCHAR(255) NOT NULL,
    item_id VARCHAR(36) NOT NULL,
    status VARCHAR(30) NOT NULL,
    labeler_a_id VARCHAR(255),
    labeler_b_id VARCHAR(255),
    resolution_note VARCHAR(2000),
    created_at DATETIME NOT NULL,
    INDEX idx_item (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sla_jobs (
    id VARCHAR(36) PRIMARY KEY,
    task_id VARCHAR(255) NOT NULL,
    item_id VARCHAR(36),
    job_type VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL,
    scheduled_at DATETIME NOT NULL,
    executed_at DATETIME,
    created_at DATETIME NOT NULL,
    INDEX idx_task (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
