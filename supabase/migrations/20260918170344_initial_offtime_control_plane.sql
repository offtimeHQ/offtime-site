-- Offtime control-plane PostgreSQL schema.
--
-- This is intentionally compatible with the current MVP's string-based
-- RFC3339 timestamps and JSON serialization. The application adapter can
-- therefore be migrated independently from the schema.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_accounts (
  user_id TEXT PRIMARY KEY REFERENCES users(user_id),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('provider', 'renter')),
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_sessions (
  session_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS worker_enrollments (
  code_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id),
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE IF NOT EXISTS workers (
  worker_id TEXT PRIMARY KEY,
  public_key TEXT NOT NULL,
  key_algorithm TEXT NOT NULL,
  software_version TEXT NOT NULL,
  platform TEXT NOT NULL,
  availability TEXT NOT NULL,
  last_heartbeat TEXT NOT NULL,
  registered_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS worker_owners (
  worker_id TEXT PRIMARY KEY REFERENCES workers(worker_id),
  user_id TEXT NOT NULL REFERENCES users(user_id),
  sharing_enabled SMALLINT NOT NULL DEFAULT 1 CHECK (sharing_enabled IN (0, 1))
);

CREATE TABLE IF NOT EXISTS worker_devices (
  device_id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL REFERENCES workers(worker_id),
  type TEXT NOT NULL,
  vendor TEXT NOT NULL,
  architecture TEXT NOT NULL,
  backend TEXT NOT NULL,
  memory_bytes BIGINT NOT NULL,
  features_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS worker_sessions (
  session_id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL REFERENCES workers(worker_id),
  connected_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  state TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  job_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES users(user_id),
  template_id TEXT NOT NULL,
  template_version TEXT NOT NULL,
  spec_json TEXT NOT NULL,
  state TEXT NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 0,
  next_fencing_token BIGINT NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL,
  available_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS jobs_queue_idx ON jobs(state, available_at);

CREATE TABLE IF NOT EXISTS job_attempts (
  attempt_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(job_id),
  attempt_number INTEGER NOT NULL,
  worker_id TEXT REFERENCES workers(worker_id),
  state TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  failure_class TEXT,
  failure_code TEXT,
  failure_message TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS attempts_job_number
  ON job_attempts(job_id, attempt_number);

CREATE TABLE IF NOT EXISTS leases (
  lease_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(job_id),
  attempt_id TEXT NOT NULL REFERENCES job_attempts(attempt_id),
  worker_id TEXT NOT NULL REFERENCES workers(worker_id),
  fencing_token BIGINT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  state TEXT NOT NULL,
  acknowledged_at TEXT,
  renewed_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS active_job_lease
  ON leases(job_id) WHERE state = 'ACTIVE';

CREATE TABLE IF NOT EXISTS artifacts (
  artifact_id TEXT PRIMARY KEY,
  sha256 TEXT NOT NULL UNIQUE,
  size_bytes BIGINT NOT NULL,
  media_type TEXT NOT NULL,
  storage_ref TEXT NOT NULL,
  created_at TEXT NOT NULL,
  retention_state TEXT NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS artifact_manifests (
  manifest_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(job_id),
  attempt_id TEXT NOT NULL REFERENCES job_attempts(attempt_id),
  purpose TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  signer_key_id TEXT NOT NULL,
  signature TEXT NOT NULL,
  signature_algorithm TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workload_templates (
  template_id TEXT NOT NULL,
  template_version TEXT NOT NULL,
  definition_json TEXT NOT NULL,
  approved SMALLINT NOT NULL CHECK (approved IN (0, 1)),
  PRIMARY KEY (template_id, template_version)
);

CREATE TABLE IF NOT EXISTS metering_events (
  event_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(job_id),
  attempt_id TEXT NOT NULL REFERENCES job_attempts(attempt_id),
  worker_id TEXT NOT NULL,
  duration_ms BIGINT NOT NULL,
  units BIGINT NOT NULL,
  customer_debit BIGINT NOT NULL,
  worker_credit BIGINT NOT NULL,
  platform_fee BIGINT NOT NULL,
  occurred_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  entry_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES metering_events(event_id),
  principal_id TEXT NOT NULL,
  entry_type TEXT NOT NULL,
  amount BIGINT NOT NULL,
  job_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ledger_event_principal_type
  ON ledger_entries(event_id, principal_id, entry_type);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  scope TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (scope, idempotency_key)
);

CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  job_id TEXT,
  attempt_id TEXT,
  worker_id TEXT,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS events_job_idx ON events(job_id, created_at);
CREATE INDEX IF NOT EXISTS leases_worker_state_idx ON leases(worker_id, state);
CREATE INDEX IF NOT EXISTS worker_heartbeat_idx ON workers(availability, last_heartbeat);

-- The dashboard and workers must go through the Offtime control-plane API.
-- No public Supabase Data API policies are created in this migration.
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE workload_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE metering_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

;
