CREATE TABLE kdtp_registry.knowledge_records (
  record_key text PRIMARY KEY,
  record_schema_version text NOT NULL,
  knowledge_id text NOT NULL,
  knowledge_version text NOT NULL,
  version_major numeric(16, 0) NOT NULL,
  version_minor numeric(16, 0) NOT NULL,
  version_patch numeric(16, 0) NOT NULL,
  status text NOT NULL,
  scope_level text NOT NULL,
  scope_key text NOT NULL,
  revision bigint NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  knowledge jsonb NOT NULL,

  CONSTRAINT knowledge_records_identity_unique UNIQUE (knowledge_id, knowledge_version),
  CONSTRAINT knowledge_records_key_consistent
    CHECK (record_key = knowledge_id || '@' || knowledge_version),
  CONSTRAINT knowledge_records_schema_supported
    CHECK (record_schema_version = 'knowledge-registry-record/v1'),
  CONSTRAINT knowledge_records_version_non_negative
    CHECK (version_major >= 0 AND version_minor >= 0 AND version_patch >= 0),
  CONSTRAINT knowledge_records_status_valid
    CHECK (status IN ('DRAFT', 'REVIEWING', 'PUBLISHED', 'DEPRECATED', 'ARCHIVED')),
  CONSTRAINT knowledge_records_scope_valid
    CHECK (scope_level IN ('GLOBAL', 'DOMAIN', 'PROJECT', 'ENVIRONMENT', 'RELEASE')),
  CONSTRAINT knowledge_records_revision_positive CHECK (revision > 0),
  CONSTRAINT knowledge_records_time_order CHECK (updated_at >= created_at),
  CONSTRAINT knowledge_records_json_identity_consistent CHECK (
    knowledge ->> 'id' = knowledge_id
    AND knowledge ->> 'version' = knowledge_version
    AND knowledge ->> 'status' = status
    AND knowledge #>> '{scope,level}' = scope_level
    AND knowledge #>> '{scope,key}' = scope_key
  )
);

CREATE INDEX knowledge_records_identity_versions_idx
  ON kdtp_registry.knowledge_records (
    knowledge_id,
    version_major DESC,
    version_minor DESC,
    version_patch DESC
  );

CREATE INDEX knowledge_records_scope_status_idx
  ON kdtp_registry.knowledge_records (scope_level, scope_key, status, knowledge_id);

CREATE TABLE kdtp_registry.knowledge_history (
  record_key text NOT NULL REFERENCES kdtp_registry.knowledge_records(record_key) ON DELETE RESTRICT,
  sequence bigint NOT NULL,
  event_type text NOT NULL,
  from_status text,
  to_status text NOT NULL,
  actor text NOT NULL,
  occurred_at timestamptz NOT NULL,
  reason text NOT NULL,

  PRIMARY KEY (record_key, sequence),
  CONSTRAINT knowledge_history_sequence_positive CHECK (sequence > 0),
  CONSTRAINT knowledge_history_type_valid
    CHECK (event_type IN ('CREATED', 'DRAFT_REPLACED', 'STATUS_TRANSITIONED')),
  CONSTRAINT knowledge_history_from_status_valid CHECK (
    from_status IS NULL OR from_status IN ('DRAFT', 'REVIEWING', 'PUBLISHED', 'DEPRECATED', 'ARCHIVED')
  ),
  CONSTRAINT knowledge_history_to_status_valid
    CHECK (to_status IN ('DRAFT', 'REVIEWING', 'PUBLISHED', 'DEPRECATED', 'ARCHIVED')),
  CONSTRAINT knowledge_history_actor_nonempty CHECK (length(actor) BETWEEN 1 AND 512),
  CONSTRAINT knowledge_history_reason_nonempty CHECK (length(reason) BETWEEN 1 AND 512)
);

CREATE INDEX knowledge_history_record_sequence_idx
  ON kdtp_registry.knowledge_history (record_key, sequence);

CREATE OR REPLACE FUNCTION kdtp_registry.protect_knowledge_record_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.record_key <> OLD.record_key
    OR NEW.knowledge_id <> OLD.knowledge_id
    OR NEW.knowledge_version <> OLD.knowledge_version
    OR NEW.version_major <> OLD.version_major
    OR NEW.version_minor <> OLD.version_minor
    OR NEW.version_patch <> OLD.version_patch
    OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'knowledge record identity is immutable' USING ERRCODE = '23514';
  END IF;

  IF NEW.revision <> OLD.revision + 1 THEN
    RAISE EXCEPTION 'knowledge revision must advance by exactly one' USING ERRCODE = '23514';
  END IF;

  IF NEW.updated_at < OLD.updated_at THEN
    RAISE EXCEPTION 'knowledge updated_at cannot move backwards' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER knowledge_records_protect_identity
BEFORE UPDATE ON kdtp_registry.knowledge_records
FOR EACH ROW EXECUTE FUNCTION kdtp_registry.protect_knowledge_record_identity();

CREATE OR REPLACE FUNCTION kdtp_registry.reject_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'knowledge history is append-only' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER knowledge_history_reject_update
BEFORE UPDATE OR DELETE ON kdtp_registry.knowledge_history
FOR EACH ROW EXECUTE FUNCTION kdtp_registry.reject_history_mutation();
