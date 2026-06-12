-- Pumps: Gym Journaling Module for Flip
-- Add to existing flip Supabase project

-- Enable UUID generation (if not already)
create extension if not exists "uuid-ossp";

-- Profiles (extends flip's auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Exercises (built-in + custom)
create table if not exists exercises (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  category text not null default 'other',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Workouts
create table if not exists workouts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Workout <-> Exercise join
create table if not exists workout_exercises (
  id uuid primary key default uuid_generate_v4(),
  workout_id uuid not null references workouts(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  sort_order int not null default 0
);

-- Individual sets
create table if not exists exercise_sets (
  id uuid primary key default uuid_generate_v4(),
  workout_exercise_id uuid not null references workout_exercises(id) on delete cascade,
  set_number int not null default 1,
  reps int not null default 0,
  weight_kg numeric(6,2) not null default 0,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

-- Competitions
create table if not exists competitions (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  exercise_id uuid not null references exercises(id) on delete cascade,
  type text not null check (type in ('max_weight', 'max_reps', 'total_volume')),
  status text not null default 'waiting' check (status in ('waiting', 'active', 'completed')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Competition participants
create table if not exists competition_participants (
  id uuid primary key default uuid_generate_v4(),
  competition_id uuid not null references competitions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique(competition_id, user_id)
);

-- Competition logs (realtime)
create table if not exists competition_logs (
  id uuid primary key default uuid_generate_v4(),
  competition_id uuid not null references competitions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  set_number int not null,
  reps int not null,
  weight_kg numeric(6,2) not null,
  logged_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Enable RLS
alter table profiles enable row level security;
alter table exercises enable row level security;
alter table workouts enable row level security;
alter table workout_exercises enable row level security;
alter table exercise_sets enable row level security;
alter table competitions enable row level security;
alter table competition_participants enable row level security;
alter table competition_logs enable row level security;

-- RLS Policies
create policy "Profiles viewable by all" on profiles for select using (true);
create policy "Users update own profile" on profiles for update using (auth.uid() = id);

create policy "Exercises viewable by all" on exercises for select using (true);
create policy "Auth users create exercises" on exercises for insert with check (auth.role() = 'authenticated');

create policy "Own workouts select" on workouts for select using (auth.uid() = user_id);
create policy "Own workouts insert" on workouts for insert with check (auth.uid() = user_id);
create policy "Own workouts update" on workouts for update using (auth.uid() = user_id);
create policy "Own workouts delete" on workouts for delete using (auth.uid() = user_id);

create policy "Own WE select" on workout_exercises for select using (
  exists (select 1 from workouts where workouts.id = workout_exercises.workout_id and workouts.user_id = auth.uid())
);
create policy "Own WE insert" on workout_exercises for insert with check (
  exists (select 1 from workouts where workouts.id = workout_exercises.workout_id and workouts.user_id = auth.uid())
);
create policy "Own WE delete" on workout_exercises for delete using (
  exists (select 1 from workouts where workouts.id = workout_exercises.workout_id and workouts.user_id = auth.uid())
);

create policy "Own sets select" on exercise_sets for select using (
  exists (
    select 1 from workout_exercises we
    join workouts w on w.id = we.workout_id
    where we.id = exercise_sets.workout_exercise_id and w.user_id = auth.uid()
  )
);
create policy "Own sets insert" on exercise_sets for insert with check (
  exists (
    select 1 from workout_exercises we
    join workouts w on w.id = we.workout_id
    where we.id = exercise_sets.workout_exercise_id and w.user_id = auth.uid()
  )
);

create policy "Comps viewable by all" on competitions for select using (true);
create policy "Auth users create comps" on competitions for insert with check (auth.role() = 'authenticated');
create policy "Creator update comp" on competitions for update using (auth.uid() = created_by);

create policy "Participants viewable" on competition_participants for select using (true);
create policy "Auth users join" on competition_participants for insert with check (auth.uid() = user_id);

create policy "Comp logs viewable" on competition_logs for select using (true);
create policy "Participants log" on competition_logs for insert with check (
  auth.uid() = user_id and
  exists (
    select 1 from competition_participants
    where competition_id = competition_logs.competition_id and user_id = auth.uid()
  )
);

-- Enable Supabase Realtime
alter publication supabase_realtime add table competition_logs;
alter publication supabase_realtime add table competitions;
alter publication supabase_realtime add table competition_participants;

-- Seed built-in exercises
insert into exercises (name, category) values
  ('Bench Press', 'chest'),
  ('Incline Bench Press', 'chest'),
  ('Dumbbell Fly', 'chest'),
  ('Squat', 'legs'),
  ('Deadlift', 'back'),
  ('Pull-Up', 'back'),
  ('Barbell Row', 'back'),
  ('Overhead Press', 'shoulders'),
  ('Lateral Raise', 'shoulders'),
  ('Bicep Curl', 'arms'),
  ('Tricep Pushdown', 'arms'),
  ('Leg Press', 'legs'),
  ('Romanian Deadlift', 'legs'),
  ('Cable Crossover', 'chest'),
  ('Face Pull', 'shoulders'),
  ('Hammer Curl', 'arms'),
  ('Skull Crusher', 'arms'),
  ('Lat Pulldown', 'back'),
  ('Leg Extension', 'legs'),
  ('Leg Curl', 'legs'),
  ('Calf Raise', 'legs'),
  ('Plank', 'core'),
  ('Russian Twist', 'core'),
  ('Hanging Leg Raise', 'core')
on conflict (name) do nothing;
