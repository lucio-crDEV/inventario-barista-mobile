-- Operational aggregates only. No user/session identifiers or inventory values.
CREATE TABLE IF NOT EXISTS usage_daily (
 day TEXT NOT NULL,
 route TEXT NOT NULL,
 method TEXT NOT NULL,
 status_class INTEGER NOT NULL CHECK(status_class BETWEEN 1 AND 5),
 requests INTEGER NOT NULL DEFAULT 0,
 elapsed_ms INTEGER NOT NULL DEFAULT 0,
 slow_requests INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(day,route,method,status_class)
) WITHOUT ROWID;
