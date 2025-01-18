/*
  # Create documents table and vector search function

  1. New Tables
    - `documents`
      - `id` (uuid, primary key)
      - `content` (text)
      - `url` (text)
      - `embedding` (vector)
      - `created_at` (timestamp)

  2. Functions
    - `match_documents`: Vector similarity search function
    
  3. Security
    - Enable RLS on `documents` table
    - Add policy for public read access
*/

-- Enable the vector extension
create extension if not exists vector;

-- Create the documents table
create table if not exists documents (
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

-- Drop the existing function if it exists
drop function if exists match_documents(vector(1536), float, int);

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