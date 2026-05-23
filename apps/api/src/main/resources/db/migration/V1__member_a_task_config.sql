CREATE TABLE tasks (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(32) NOT NULL,
  owner_id VARCHAR(64) NOT NULL,
  trace_id VARCHAR(128) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE task_instruction_versions (
  id VARCHAR(64) PRIMARY KEY,
  task_id VARCHAR(64) NOT NULL,
  version INT NOT NULL,
  content MEDIUMTEXT NOT NULL,
  examples_json JSON NOT NULL,
  frozen BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE task_schema_versions (
  id VARCHAR(64) PRIMARY KEY,
  task_id VARCHAR(64) NOT NULL,
  version INT NOT NULL,
  schema_json JSON NOT NULL,
  frozen BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_task_schema_version (task_id, version)
);

CREATE TABLE rubric_versions (
  id VARCHAR(64) PRIMARY KEY,
  task_id VARCHAR(64) NOT NULL,
  version INT NOT NULL,
  prompt_template TEXT NOT NULL,
  dimensions_json JSON NOT NULL,
  rules_json JSON NOT NULL,
  frozen BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_task_rubric_version (task_id, version)
);

CREATE TABLE datasets (
  id VARCHAR(64) PRIMARY KEY,
  task_id VARCHAR(64) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(32) NOT NULL,
  row_count INT NOT NULL DEFAULT 0,
  field_mapping_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE data_items (
  id VARCHAR(64) PRIMARY KEY,
  dataset_id VARCHAR(64) NOT NULL,
  task_id VARCHAR(64) NOT NULL,
  raw_payload JSON NOT NULL,
  display_payload JSON NOT NULL,
  media_refs_json JSON NOT NULL,
  metadata_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE task_package_snapshots (
  id VARCHAR(64) PRIMARY KEY,
  task_id VARCHAR(64) NOT NULL,
  schema_version_id VARCHAR(64) NOT NULL,
  instruction_version_id VARCHAR(64) NOT NULL,
  rubric_version_id VARCHAR(64) NOT NULL,
  dataset_id VARCHAR(64) NOT NULL,
  package_json JSON NOT NULL,
  trace_id VARCHAR(128) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE task_config_audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  task_id VARCHAR(64) NOT NULL,
  actor_id VARCHAR(64) NOT NULL,
  action VARCHAR(64) NOT NULL,
  before_json JSON,
  after_json JSON,
  trace_id VARCHAR(128) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
