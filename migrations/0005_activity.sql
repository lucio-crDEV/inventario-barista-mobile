-- Additive and optional for old code; apply before publishing code that reads metrics.
-- No inventory, permissions, sessions or historical author data is modified.
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
