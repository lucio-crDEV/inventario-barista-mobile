-- Aggregates only; no identifiers, messages, URLs or payload content.
CREATE TABLE IF NOT EXISTS telemetry_hourly (
 hour TEXT NOT NULL, version TEXT NOT NULL, kind TEXT NOT NULL,
 route TEXT NOT NULL, device TEXT NOT NULL, metric TEXT NOT NULL, bucket TEXT NOT NULL,
 n INTEGER NOT NULL, value_sum INTEGER NOT NULL,
 PRIMARY KEY(hour,version,kind,route,device,metric,bucket)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS collector_health (
 day TEXT NOT NULL, version TEXT NOT NULL, last_success_at TEXT NOT NULL,
 flushes INTEGER NOT NULL, recorded INTEGER NOT NULL, known_lost INTEGER NOT NULL,
 failed_flushes INTEGER NOT NULL, max_buffer_age_ms INTEGER NOT NULL,
 PRIMARY KEY(day,version)
) WITHOUT ROWID;
