CREATE TABLE kdtp_governance.review_decisions (
  decision_id text NOT NULL,
  schema_version text NOT NULL,
  project_id text NOT NULL,
  record_key text NOT NULL,
  knowledge_id text NOT NULL,
  knowledge_version text NOT NULL,
  review_revision bigint NOT NULL,
  decision text NOT NULL,
  reviewer text NOT NULL,
  occurred_at timestamptz NOT NULL,
  reason text NOT NULL,
  decision_payload jsonb NOT NULL,
  CONSTRAINT review_decisions_decision_id_pk PRIMARY KEY (decision_id),
  CONSTRAINT review_decisions_reviewer_revision_uq
    UNIQUE (project_id, record_key, review_revision, reviewer),
  CONSTRAINT review_decisions_registry_fk
    FOREIGN KEY (record_key)
    REFERENCES kdtp_registry.knowledge_records(record_key)
    ON DELETE RESTRICT,
  CONSTRAINT review_decisions_schema_ck
    CHECK (schema_version = 'knowledge-review-decision/v1'),
  CONSTRAINT review_decisions_revision_ck CHECK (review_revision > 0),
  CONSTRAINT review_decisions_value_ck
    CHECK (decision IN ('APPROVE', 'REQUEST_CHANGES')),
  CONSTRAINT review_decisions_identity_ck
    CHECK (record_key = knowledge_id || '@' || knowledge_version),
  CONSTRAINT review_decisions_payload_ck CHECK (
    decision_payload->>'schemaVersion' = schema_version AND
    decision_payload->>'decisionId' = decision_id AND
    decision_payload->>'projectId' = project_id AND
    decision_payload->>'knowledgeKey' = record_key AND
    decision_payload->>'knowledgeId' = knowledge_id AND
    decision_payload->>'version' = knowledge_version AND
    (decision_payload->>'reviewRevision')::bigint = review_revision AND
    decision_payload->>'decision' = decision AND
    decision_payload->>'reviewer' = reviewer AND
    decision_payload->>'reason' = reason
  )
);

CREATE INDEX review_decisions_lookup_idx
  ON kdtp_governance.review_decisions(project_id, record_key, review_revision, occurred_at);

CREATE TABLE kdtp_governance.snapshot_envelopes (
  snapshot_id text NOT NULL,
  schema_version text NOT NULL,
  digest text NOT NULL,
  project_id text NOT NULL,
  environment_id text NOT NULL,
  release_id text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL,
  reason text NOT NULL,
  envelope jsonb NOT NULL,
  CONSTRAINT snapshot_envelopes_snapshot_id_pk PRIMARY KEY (snapshot_id),
  CONSTRAINT snapshot_envelopes_digest_uq UNIQUE (digest),
  CONSTRAINT snapshot_envelopes_schema_ck
    CHECK (schema_version = 'knowledge-snapshot-envelope/v1'),
  CONSTRAINT snapshot_envelopes_digest_ck
    CHECK (digest ~ '^[a-f0-9]{64}$'),
  CONSTRAINT snapshot_envelopes_id_ck
    CHECK (right(snapshot_id, 12) = left(digest, 12)),
  CONSTRAINT snapshot_envelopes_payload_ck CHECK (
    envelope->>'schemaVersion' = schema_version AND
    envelope->>'snapshotId' = snapshot_id AND
    envelope->>'digest' = digest AND
    envelope->>'projectId' = project_id AND
    envelope->>'environmentId' = environment_id AND
    envelope->>'releaseId' = release_id AND
    envelope->>'createdBy' = created_by AND
    envelope->>'reason' = reason AND
    envelope->'snapshot'->>'snapshotId' = snapshot_id AND
    envelope->'snapshot'->>'digest' = digest AND
    envelope->'snapshot'->'context'->>'projectId' = project_id AND
    envelope->'snapshot'->'context'->>'environmentId' = environment_id AND
    envelope->'snapshot'->'context'->>'releaseId' = release_id
  )
);

CREATE INDEX snapshot_envelopes_project_idx
  ON kdtp_governance.snapshot_envelopes(project_id, environment_id, release_id, created_at);

CREATE OR REPLACE FUNCTION kdtp_governance.reject_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'governance evidence is append-only and immutable'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER review_decisions_immutable
BEFORE UPDATE OR DELETE ON kdtp_governance.review_decisions
FOR EACH ROW EXECUTE FUNCTION kdtp_governance.reject_evidence_mutation();

CREATE TRIGGER snapshot_envelopes_immutable
BEFORE UPDATE OR DELETE ON kdtp_governance.snapshot_envelopes
FOR EACH ROW EXECUTE FUNCTION kdtp_governance.reject_evidence_mutation();
