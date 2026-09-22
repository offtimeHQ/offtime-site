-- Cover the foreign-key columns used by ownership, job history, leases, and metering queries.
-- These indexes are intentionally additive and safe to run against an existing pilot database.

CREATE INDEX IF NOT EXISTS artifact_manifests_job_idx
  ON artifact_manifests(job_id);
CREATE INDEX IF NOT EXISTS artifact_manifests_attempt_idx
  ON artifact_manifests(attempt_id);
CREATE INDEX IF NOT EXISTS job_attempts_worker_idx
  ON job_attempts(worker_id);
CREATE INDEX IF NOT EXISTS jobs_customer_idx
  ON jobs(customer_id);
CREATE INDEX IF NOT EXISTS leases_attempt_idx
  ON leases(attempt_id);
CREATE INDEX IF NOT EXISTS metering_events_attempt_idx
  ON metering_events(attempt_id);
CREATE INDEX IF NOT EXISTS metering_events_job_idx
  ON metering_events(job_id);
CREATE INDEX IF NOT EXISTS user_sessions_user_idx
  ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS worker_devices_worker_idx
  ON worker_devices(worker_id);
CREATE INDEX IF NOT EXISTS worker_enrollments_user_idx
  ON worker_enrollments(user_id);
CREATE INDEX IF NOT EXISTS worker_owners_user_idx
  ON worker_owners(user_id);
CREATE INDEX IF NOT EXISTS worker_sessions_worker_idx
  ON worker_sessions(worker_id);;
