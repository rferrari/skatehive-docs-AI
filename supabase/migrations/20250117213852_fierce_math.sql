/*
  # Initialize Documentation Database

  1. New Tables
    - `documents`
      - `id` (uuid, primary key)
      - `content` (text)
      - `url` (text)
      - `embedding` (vector)
      - `created_at` (timestamptz)
  2. Security
    - Enable RLS on `documents` table
    - Add policy for public read access
  3. Functions
    - `match_documents` for vector similarity search
    - `is_zero_vector` for vector validation
*/

-- Drop objects in the correct order to handle dependencies
do $$ 
begin
    -- First drop the constraint that depends on the function
    if exists (
        select 1
        from pg_constraint
        where conname = 'non_zero_embedding'
    ) then
        alter table if exists documents drop constraint if exists non_zero_embedding;
    end if;

    -- Now we can safely drop the functions
    drop function if exists match_documents(vector(1536), float, int);
    drop function if exists is_zero_vector(vector);
    
    -- Finally drop the table
    drop table if exists documents;
end $$;

-- Enable the vector extension
create extension if not exists vector;

-- Create the documents table
create table documents (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  url text not null,
  embedding vector(1536),
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table documents enable row level security;

-- Create policy for public read access
create policy "Allow public read access"
  on documents
  for select
  to public
  using (true);

-- Create the vector similarity search function
create function match_documents(
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
create function is_zero_vector(v vector)
returns boolean
language plpgsql
as $$
begin
  return v = array_fill(0::float, array[1536])::vector;
end;
$$;

-- Add constraint to prevent zero vectors
alter table documents
  add constraint non_zero_embedding
  check (not is_zero_vector(embedding));

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