-- Repair migration for databases created before details_json was added to V2
ALTER TABLE business_nodes
  ADD COLUMN details_json JSON NULL;

ALTER TABLE business_nodes
  MODIFY COLUMN id VARCHAR(128) NOT NULL,
  MODIFY COLUMN trace_id VARCHAR(128) NOT NULL;

ALTER TABLE trace_nodes
  MODIFY COLUMN id VARCHAR(128) NOT NULL,
  MODIFY COLUMN parent_id VARCHAR(128) NULL;
