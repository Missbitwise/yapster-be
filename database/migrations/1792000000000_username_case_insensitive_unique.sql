-- Up Migration
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM users
    GROUP BY LOWER(username)
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce case-insensitive username uniqueness: duplicate usernames already exist';
  END IF;
END
$$;

UPDATE users
SET username = LOWER(username)
WHERE username <> LOWER(username);

CREATE UNIQUE INDEX users_username_lower_unique
ON users (LOWER(username));

-- Down Migration
DROP INDEX IF EXISTS users_username_lower_unique;
