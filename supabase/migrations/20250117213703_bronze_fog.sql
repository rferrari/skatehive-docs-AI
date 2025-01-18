/*
  # Create documents table for vector search

  1. New Tables
    - `documents`
      - `id` (uuid, primary key)
      - `content` (text)
      - `url` (text)
      - `embedding` (vector)
      - `created_at` (timestamptz)

  2. Functions
    - `match_documents` for vector similarity search
    - `is_zero_vector` for validation

  3. Security
    - Enable RLS on `documents` table
    - Add policy for public read access
*/

-- Enable the vector extension if not already enabled
create extension if not exists vector;

-- Create the documents table if it doesn't exist
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  url text not null,
  embedding vector(1536),
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table documents enable row level security;

-- Create policy for public read access if it doesn't exist
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'documents'
      and policyname = 'Allow public read access'
  ) then
    create policy "Allow public read access"
      on documents
      for select
      to public
      using (true);
  end if;
end $$;

-- Create the vector similarity search function
create or replace function match_documents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  content text,
  url text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    documents.id,
    documents.content,
    documents.url,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
end;
$$;

-- Create function to check if a vector is all zeros
create or replace function is_zero_vector(v vector)
returns boolean
language plpgsql
as $$
begin
  return v = array_fill(0::float, array[1536])::vector;
end;
$$;

-- Add constraint to prevent zero vectors if it doesn't exist
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'non_zero_embedding'
  ) then
    alter table documents
      add constraint non_zero_embedding
      check (not is_zero_vector(embedding));
  end if;
end $$;

-- Insert sample documentation
insert into documents (content, url, embedding) values
(
  E'# Getting Started\n\nWelcome to our documentation! This guide will help you get started with our platform.\n\n## Quick Start\n\n1. Install the package\n2. Initialize the configuration\n3. Start using the platform',
  '/docs/latest/getting-started',
  (
    select array_agg(x.val)::vector
    from (
      select 
        case 
          when row_number() over () = 1 then 0.1
          else random() * 0.01
        end as val
      from generate_series(1, 1536)
    ) x
  )
),
(
  E'# Configuration\n\nThis guide covers the configuration options available for our platform.\n\n## Basic Configuration\n\nCreate a config.json file in your project root\n\n## Environment Variables\n\nRequired environment variables',
  '/docs/latest/configuration',
  (
    select array_agg(x.val)::vector
    from (
      select 
        case 
          when row_number() over () = 1 then 0.1
          else random() * 0.01
        end as val
      from generate_series(1, 1536)
    ) x
  )
),
(
  E'# API Reference\n\nComplete documentation for our REST API endpoints.\n\n## Authentication\n\nAll API requests require authentication using Bearer tokens\n\n## Endpoints\n\n### Users\n\n- GET /api/users\n- POST /api/users',
  '/docs/latest/api-reference',
  (
    select array_agg(x.val)::vector
    from (
      select 
        case 
          when row_number() over () = 1 then 0.1
          else random() * 0.01
        end as val
      from generate_series(1, 1536)
    ) x
  )
);