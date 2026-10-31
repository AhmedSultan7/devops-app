-- Run as a PostgreSQL administrator: psql -U postgres -f db/init.sql
CREATE ROLE shop_user WITH LOGIN PASSWORD 'shop_dev_password';

CREATE DATABASE products_db OWNER shop_user;
CREATE DATABASE orders_db OWNER shop_user;

\connect products_db

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO products (name, description, price, stock, image_url)
VALUES
  ('Mechanical Keyboard', 'Compact mechanical keyboard with tactile switches.', 79.99, 18, ''),
  ('Wireless Mouse', 'Ergonomic wireless mouse with adjustable DPI.', 34.50, 30, ''),
  ('USB-C Hub', 'Seven-port USB-C hub for laptops and tablets.', 49.00, 12, ''),
  ('Laptop Stand', 'Aluminium adjustable laptop stand.', 42.75, 20, ''),
  ('Noise-Cancelling Headphones', 'Over-ear headphones for focused work.', 119.00, 8, '')
ON CONFLICT DO NOTHING;

\connect orders_db

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  customer_name VARCHAR(120) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'confirmed',
  total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL,
  product_name VARCHAR(120) NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0)
);
