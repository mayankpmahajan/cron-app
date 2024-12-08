CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100),
  age INTEGER
);

CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200),
  description TEXT,
  user_id INTEGER REFERENCES users(id),
  completed BOOLEAN DEFAULT false
);