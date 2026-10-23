-- HISTORICAL PROPOSAL ONLY: not approved, not an automatic migration.
-- Persistence and retention are deferred as of 2026-10-23. Do not apply.
CREATE TABLE activity_hourly (
 hour INTEGER NOT NULL,
 actor TEXT NOT NULL,
 route TEXT NOT NULL,
 scope TEXT NOT NULL,
 outcome TEXT NOT NULL,
 observations INTEGER NOT NULL DEFAULT 1,
 last_seen INTEGER NOT NULL,
 PRIMARY KEY(hour,actor,route,scope,outcome)
);
CREATE INDEX activity_recent ON activity_hourly(last_seen);
