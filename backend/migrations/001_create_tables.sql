create extension if not exists pgcrypto;

create table users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  wallet_address text not null unique,
  role text not null check (role in ('client', 'freelancer')),
  created_at timestamptz not null default now()
);

create table invoices (
  id text primary key,
  freelancer_username text not null,
  freelancer_address text not null,
  client_username text not null references users(username),
  description text not null,
  currency text not null,
  accepted_settlement_currencies text[] not null,
  amount numeric not null,
  amount_units text not null,
  due_date date not null,
  status text not null default 'UNPAID',
  tx_hash text,
  paid_with text,
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  username text not null references users(username),
  type text not null,
  invoice_id text references invoices(id),
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_username_idx
on notifications(username, created_at desc);