CREATE SCHEMA IF NOT EXISTS kdtp_access;

CREATE TABLE IF NOT EXISTS kdtp_access.projects (
  project_id text PRIMARY KEY,
  name text NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED')),
  revision integer NOT NULL CHECK (revision > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CHECK (project_id ~ '^[a-z0-9][a-z0-9._-]{1,127}$'),
  CHECK (char_length(name) BETWEEN 1 AND 200),
  CHECK (updated_at >= created_at)
);

CREATE TABLE IF NOT EXISTS kdtp_access.project_history (
  project_id text NOT NULL REFERENCES kdtp_access.projects(project_id) ON DELETE RESTRICT,
  sequence integer NOT NULL CHECK (sequence > 0),
  event_type text NOT NULL CHECK (event_type IN ('CREATED', 'UPDATED')),
  from_status text NULL,
  to_status text NOT NULL CHECK (to_status IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED')),
  actor text NOT NULL,
  occurred_at timestamptz NOT NULL,
  reason text NOT NULL,
  PRIMARY KEY (project_id, sequence)
);

CREATE TABLE IF NOT EXISTS kdtp_access.project_memberships (
  project_id text NOT NULL REFERENCES kdtp_access.projects(project_id) ON DELETE RESTRICT,
  subject text NOT NULL,
  roles text[] NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED')),
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NULL,
  revision integer NOT NULL CHECK (revision > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (project_id, subject),
  CHECK (cardinality(roles) > 0),
  CHECK (roles <@ ARRAY['VIEWER','AUTHOR','REVIEWER','PUBLISHER','AUDITOR','AUTOMATION','PROJECT_ADMIN']::text[]),
  CHECK (valid_until IS NULL OR valid_until > valid_from),
  CHECK (updated_at >= created_at)
);

CREATE TABLE IF NOT EXISTS kdtp_access.membership_history (
  project_id text NOT NULL,
  subject text NOT NULL,
  sequence integer NOT NULL CHECK (sequence > 0),
  event_type text NOT NULL CHECK (event_type IN ('CREATED', 'UPDATED')),
  from_status text NULL,
  to_status text NOT NULL CHECK (to_status IN ('ACTIVE', 'SUSPENDED', 'REVOKED')),
  actor text NOT NULL,
  occurred_at timestamptz NOT NULL,
  reason text NOT NULL,
  PRIMARY KEY (project_id, subject, sequence),
  FOREIGN KEY (project_id, subject)
    REFERENCES kdtp_access.project_memberships(project_id, subject)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS project_memberships_subject_idx
  ON kdtp_access.project_memberships(subject, project_id);
CREATE INDEX IF NOT EXISTS project_memberships_project_status_idx
  ON kdtp_access.project_memberships(project_id, status, subject);

CREATE OR REPLACE FUNCTION kdtp_access.reject_access_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'project access history is append-only' USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS project_history_append_only ON kdtp_access.project_history;
CREATE TRIGGER project_history_append_only
BEFORE UPDATE OR DELETE ON kdtp_access.project_history
FOR EACH ROW EXECUTE FUNCTION kdtp_access.reject_access_history_mutation();

DROP TRIGGER IF EXISTS membership_history_append_only ON kdtp_access.membership_history;
CREATE TRIGGER membership_history_append_only
BEFORE UPDATE OR DELETE ON kdtp_access.membership_history
FOR EACH ROW EXECUTE FUNCTION kdtp_access.reject_access_history_mutation();
