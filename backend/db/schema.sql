CREATE TABLE users (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(60) NOT NULL
    CHECK (char_length(name) BETWEEN 20 AND 60),
  email VARCHAR(255) NOT NULL UNIQUE,
  address VARCHAR(400) NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL
    CHECK (role IN ('system_admin', 'normal_user', 'store_owner')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
