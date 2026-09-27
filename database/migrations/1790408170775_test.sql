-- Up Migration

CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,

    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,

    profile_picture TEXT,
    bio TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID UNIQUE NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,

    locality VARCHAR(150),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE friend_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    sender_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    receiver_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    status VARCHAR(20) NOT NULL DEFAULT 'pending',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CHECK (sender_id <> receiver_id),

    CHECK (status IN ('pending', 'accepted', 'rejected'))
);


CREATE TABLE friends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    friend_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CHECK (user_id <> friend_id),

    UNIQUE (user_id, friend_id)
);



CREATE TABLE blocked_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    blocker_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    blocked_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CHECK (blocker_id <> blocked_id),

    UNIQUE (blocker_id, blocked_id)
);


CREATE INDEX idx_users_username
ON users(username);

CREATE INDEX idx_friend_requests_receiver
ON friend_requests(receiver_id);

CREATE INDEX idx_friend_requests_sender
ON friend_requests(sender_id);

CREATE INDEX idx_friends_user
ON friends(user_id);

CREATE INDEX idx_friends_friend
ON friends(friend_id);

CREATE INDEX idx_blocked_users_blocker
ON blocked_users(blocker_id);

CREATE INDEX idx_blocked_users_blocked
ON blocked_users(blocked_id);

CREATE INDEX idx_locations_user
ON locations(user_id);

-- Down Migration