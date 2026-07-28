CREATE TABLE kdtp_test_plan.test_plan_records (
  plan_id text PRIMARY KEY,
  schema_version text NOT NULL,
  project_id text NOT NULL,
  environment_id text NOT NULL,
  release_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT','REVIEWING','APPROVED','FROZEN','SUPERSEDED','ARCHIVED')),
  revision integer NOT NULL CHECK (revision > 0),
  input_fingerprint text NOT NULL,
  snapshot_id text NOT NULL,
  snapshot_digest text NOT NULL,
  capability_catalog_version text NOT NULL,
  capability_catalog_digest text NOT NULL,
  content_digest text NOT NULL,
  planning_result jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  created_by text NOT NULL,
  updated_at timestamptz NOT NULL,
  updated_by text NOT NULL,
  CONSTRAINT test_plan_records_input_fingerprint_uq UNIQUE (input_fingerprint),
  CONSTRAINT test_plan_records_plan_project_uq UNIQUE (plan_id, project_id),
  CONSTRAINT test_plan_records_schema_ck CHECK (schema_version = 'test-plan-record/v1'),
  CONSTRAINT test_plan_records_time_ck CHECK (updated_at >= created_at),
  CONSTRAINT test_plan_records_digest_ck CHECK (
    input_fingerprint ~ '^[a-f0-9]{64}$' AND
    snapshot_digest ~ '^[a-f0-9]{64}$' AND
    capability_catalog_digest ~ '^[a-f0-9]{64}$' AND
    content_digest ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT test_plan_records_payload_ck CHECK (
    jsonb_typeof(planning_result) = 'object' AND
    planning_result ? 'schemaVersion' AND
    planning_result ? 'digest' AND
    jsonb_typeof(planning_result->'plan') = 'object' AND
    planning_result->'plan' ? 'planId' AND
    planning_result->'plan' ? 'projectId' AND
    planning_result->'plan' ? 'environmentId' AND
    planning_result->'plan' ? 'releaseId' AND
    planning_result->'plan' ? 'inputFingerprint' AND
    planning_result->'plan' ? 'knowledgeSnapshot' AND
    planning_result->'plan' ? 'capabilityCatalog' AND
    jsonb_typeof(planning_result->'plan'->'knowledgeSnapshot') = 'object' AND
    planning_result->'plan'->'knowledgeSnapshot' ? 'snapshotId' AND
    planning_result->'plan'->'knowledgeSnapshot' ? 'digest' AND
    jsonb_typeof(planning_result->'plan'->'capabilityCatalog') = 'object' AND
    planning_result->'plan'->'capabilityCatalog' ? 'version' AND
    planning_result->'plan'->'capabilityCatalog' ? 'digest' AND
    planning_result->>'schemaVersion' = 'test-planning-result/v1' AND
    planning_result->>'digest' = content_digest AND
    planning_result->'plan'->>'planId' = plan_id AND
    planning_result->'plan'->>'projectId' = project_id AND
    planning_result->'plan'->>'environmentId' = environment_id AND
    planning_result->'plan'->>'releaseId' = release_id AND
    planning_result->'plan'->>'inputFingerprint' = input_fingerprint AND
    planning_result->'plan'->'knowledgeSnapshot'->>'snapshotId' = snapshot_id AND
    planning_result->'plan'->'knowledgeSnapshot'->>'digest' = snapshot_digest AND
    planning_result->'plan'->'capabilityCatalog'->>'version' = capability_catalog_version AND
    planning_result->'plan'->'capabilityCatalog'->>'digest' = capability_catalog_digest
  )
);

CREATE TABLE kdtp_test_plan.test_plan_history (
  plan_id text NOT NULL REFERENCES kdtp_test_plan.test_plan_records(plan_id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision > 0),
  event_type text NOT NULL CHECK (event_type IN ('PLAN_CREATED','PLAN_CONTENT_REPLACED','PLAN_STATUS_TRANSITIONED')),
  from_status text CHECK (from_status IS NULL OR from_status IN ('DRAFT','REVIEWING','APPROVED','FROZEN','SUPERSEDED','ARCHIVED')),
  to_status text NOT NULL CHECK (to_status IN ('DRAFT','REVIEWING','APPROVED','FROZEN','SUPERSEDED','ARCHIVED')),
  actor text NOT NULL,
  occurred_at timestamptz NOT NULL,
  history_payload jsonb NOT NULL,
  PRIMARY KEY (plan_id, revision),
  CONSTRAINT test_plan_history_payload_ck CHECK (
    jsonb_typeof(history_payload) = 'object' AND
    history_payload ? 'schemaVersion' AND
    history_payload ? 'planId' AND
    history_payload ? 'revision' AND
    history_payload ? 'type' AND
    history_payload ? 'toStatus' AND
    history_payload ? 'contentDigest' AND
    history_payload ? 'actor' AND
    history_payload ? 'at' AND
    history_payload ? 'reason' AND
    history_payload->>'schemaVersion' = 'test-plan-history-event/v1' AND
    history_payload->>'planId' = plan_id AND
    (history_payload->>'revision')::integer = revision AND
    history_payload->>'type' = event_type AND
    (history_payload->>'fromStatus') IS NOT DISTINCT FROM from_status AND
    history_payload->>'toStatus' = to_status AND
    history_payload->>'actor' = actor AND
    history_payload->>'contentDigest' ~ '^[a-f0-9]{64}$' AND
    CASE event_type
      WHEN 'PLAN_CREATED' THEN
        revision = 1 AND from_status IS NULL AND to_status = 'DRAFT'
        AND history_payload->>'previousContentDigest' IS NULL
      WHEN 'PLAN_CONTENT_REPLACED' THEN
        revision > 1 AND from_status = 'DRAFT' AND to_status = 'DRAFT'
        AND history_payload->>'previousContentDigest' ~ '^[a-f0-9]{64}$'
        AND history_payload->>'previousContentDigest' <> history_payload->>'contentDigest'
      WHEN 'PLAN_STATUS_TRANSITIONED' THEN
        revision > 1 AND from_status IS NOT NULL
        AND history_payload->>'previousContentDigest' = history_payload->>'contentDigest'
        AND CASE from_status
          WHEN 'DRAFT' THEN to_status = 'REVIEWING'
          WHEN 'REVIEWING' THEN to_status IN ('DRAFT','APPROVED')
          WHEN 'APPROVED' THEN to_status IN ('DRAFT','FROZEN')
          WHEN 'FROZEN' THEN to_status = 'SUPERSEDED'
          WHEN 'SUPERSEDED' THEN to_status = 'ARCHIVED'
          ELSE false
        END
      ELSE false
    END
  )
);

CREATE TABLE kdtp_test_plan.test_plan_review_decisions (
  decision_id text PRIMARY KEY,
  schema_version text NOT NULL CHECK (schema_version = 'test-plan-review-decision/v1'),
  plan_id text NOT NULL,
  project_id text NOT NULL,
  plan_revision integer NOT NULL CHECK (plan_revision > 0),
  decision text NOT NULL CHECK (decision IN ('APPROVE','REQUEST_CHANGES')),
  reviewer text NOT NULL,
  occurred_at timestamptz NOT NULL,
  decision_payload jsonb NOT NULL,
  CONSTRAINT test_plan_review_decisions_reviewer_revision_uq
    UNIQUE (plan_id, plan_revision, reviewer),
  CONSTRAINT test_plan_review_decisions_plan_project_fk
    FOREIGN KEY (plan_id, project_id)
    REFERENCES kdtp_test_plan.test_plan_records(plan_id, project_id)
    ON DELETE RESTRICT,
  CONSTRAINT test_plan_review_decisions_revision_fk
    FOREIGN KEY (plan_id, plan_revision)
    REFERENCES kdtp_test_plan.test_plan_history(plan_id, revision)
    ON DELETE RESTRICT,
  CONSTRAINT test_plan_review_decisions_payload_ck CHECK (
    jsonb_typeof(decision_payload) = 'object' AND
    decision_payload ? 'schemaVersion' AND
    decision_payload ? 'decisionId' AND
    decision_payload ? 'planId' AND
    decision_payload ? 'projectId' AND
    decision_payload ? 'planRevision' AND
    decision_payload ? 'decision' AND
    decision_payload ? 'reviewer' AND
    decision_payload ? 'at' AND
    decision_payload ? 'reason' AND
    decision_payload ? 'evidence' AND
    decision_payload->>'schemaVersion' = schema_version AND
    decision_payload->>'decisionId' = decision_id AND
    decision_payload->>'planId' = plan_id AND
    decision_payload->>'projectId' = project_id AND
    (decision_payload->>'planRevision')::integer = plan_revision AND
    decision_payload->>'decision' = decision AND
    decision_payload->>'reviewer' = reviewer
  )
);

CREATE INDEX test_plan_records_project_status_idx
  ON kdtp_test_plan.test_plan_records(project_id, status, plan_id);
CREATE INDEX test_plan_records_context_idx
  ON kdtp_test_plan.test_plan_records(project_id, environment_id, release_id, plan_id);
CREATE INDEX test_plan_records_snapshot_idx
  ON kdtp_test_plan.test_plan_records(project_id, snapshot_id, plan_id);
CREATE INDEX test_plan_review_decisions_plan_idx
  ON kdtp_test_plan.test_plan_review_decisions(plan_id, plan_revision, occurred_at, decision_id);

CREATE OR REPLACE FUNCTION kdtp_test_plan.reject_append_only_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'test plan evidence is append-only' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER test_plan_history_append_only
BEFORE UPDATE OR DELETE ON kdtp_test_plan.test_plan_history
FOR EACH ROW EXECUTE FUNCTION kdtp_test_plan.reject_append_only_mutation();

CREATE TRIGGER test_plan_review_decisions_append_only
BEFORE UPDATE OR DELETE ON kdtp_test_plan.test_plan_review_decisions
FOR EACH ROW EXECUTE FUNCTION kdtp_test_plan.reject_append_only_mutation();

CREATE OR REPLACE FUNCTION kdtp_test_plan.guard_test_plan_record()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  content_changed boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'test plan records cannot be deleted' USING ERRCODE = '55000';
  END IF;

  IF NEW.plan_id <> OLD.plan_id OR
     NEW.schema_version <> OLD.schema_version OR
     NEW.project_id <> OLD.project_id OR
     NEW.environment_id <> OLD.environment_id OR
     NEW.release_id <> OLD.release_id OR
     NEW.input_fingerprint <> OLD.input_fingerprint OR
     NEW.snapshot_id <> OLD.snapshot_id OR
     NEW.snapshot_digest <> OLD.snapshot_digest OR
     NEW.capability_catalog_version <> OLD.capability_catalog_version OR
     NEW.capability_catalog_digest <> OLD.capability_catalog_digest OR
     NEW.created_at <> OLD.created_at OR
     NEW.created_by <> OLD.created_by THEN
    RAISE EXCEPTION 'test plan identity and bindings are immutable' USING ERRCODE = '55000';
  END IF;

  IF NEW.revision <> OLD.revision + 1 OR NEW.updated_at < OLD.updated_at THEN
    RAISE EXCEPTION 'test plan revision and time must advance monotonically' USING ERRCODE = '55000';
  END IF;

  IF OLD.status = 'ARCHIVED' THEN
    RAISE EXCEPTION 'archived test plan records are immutable' USING ERRCODE = '55000';
  END IF;

  content_changed := NEW.content_digest <> OLD.content_digest OR NEW.planning_result <> OLD.planning_result;
  IF content_changed THEN
    IF OLD.status <> 'DRAFT' OR NEW.status <> 'DRAFT' OR NEW.content_digest = OLD.content_digest THEN
      RAISE EXCEPTION 'only DRAFT test plan content can be replaced' USING ERRCODE = '55000';
    END IF;
  ELSE
    IF NEW.status = OLD.status OR NOT (
      (OLD.status = 'DRAFT' AND NEW.status = 'REVIEWING') OR
      (OLD.status = 'REVIEWING' AND NEW.status IN ('DRAFT','APPROVED')) OR
      (OLD.status = 'APPROVED' AND NEW.status IN ('DRAFT','FROZEN')) OR
      (OLD.status = 'FROZEN' AND NEW.status = 'SUPERSEDED') OR
      (OLD.status = 'SUPERSEDED' AND NEW.status = 'ARCHIVED')
    ) THEN
      RAISE EXCEPTION 'invalid persisted test plan lifecycle transition' USING ERRCODE = '55000';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER test_plan_records_guard
BEFORE UPDATE OR DELETE ON kdtp_test_plan.test_plan_records
FOR EACH ROW EXECUTE FUNCTION kdtp_test_plan.guard_test_plan_record();
