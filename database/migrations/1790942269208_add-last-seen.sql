-- Up Migration

ALTER TABLE users
ADD COLUMN last_seen TIMESTAMP NULL;

-- Down Migration

ALTER TABLE users
DROP COLUMN last_seen;