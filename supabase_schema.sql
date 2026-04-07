-- Run this in your Supabase SQL editor to set up the database

-- Expenses table
create table if not exists expenses (
  id uuid default gen_random_uuid() primary key,
  date date not null,
  category text not null,
  description text not null,
  amount integer not null,
  payment_method text not null default 'Card',
  created_at timestamptz default now()
);

-- Gym sessions table
create table if not exists gym_sessions (
  id uuid default gen_random_uuid() primary key,
  date date not null unique,
  month text not null,
  created_at timestamptz default now()
);

-- Savings snapshots (one per month, upserted)
create table if not exists savings_snapshots (
  id uuid default gen_random_uuid() primary key,
  month text not null unique,
  emergency_balance integer not null default 0,
  investment1_balance integer not null default 0,
  investment2_balance integer not null default 0,
  investment3_balance integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for fast month-based queries
create index if not exists expenses_date_idx on expenses(date);
create index if not exists gym_sessions_month_idx on gym_sessions(month);
create index if not exists snapshots_month_idx on savings_snapshots(month);

-- Enable Row Level Security (optional but recommended)
alter table expenses enable row level security;
alter table gym_sessions enable row level security;
alter table savings_snapshots enable row level security;

-- Allow all operations for now (single-user app)
-- Replace with auth policies if you add login later
create policy "Allow all" on expenses for all using (true) with check (true);
create policy "Allow all" on gym_sessions for all using (true) with check (true);
create policy "Allow all" on savings_snapshots for all using (true) with check (true);
