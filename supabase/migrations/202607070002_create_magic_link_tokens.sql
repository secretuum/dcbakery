CREATE TABLE magic_link_tokens (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text        NOT NULL,
  token      text        NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used       boolean     NOT NULL DEFAULT false
);

CREATE INDEX magic_link_tokens_token_idx ON magic_link_tokens (token);
CREATE INDEX magic_link_tokens_email_idx ON magic_link_tokens (email, expires_at);
