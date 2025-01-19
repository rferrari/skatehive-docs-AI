import { createClient } from '@supabase/supabase-js';
import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import OpenAI from 'openai';
import path from 'path';

export const prerender = false;
export const output = 'server';

// Initialize environment variables
const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseKey = import.meta.env.SUPABASE_ANON_KEY;
const openaiKey = import.meta.env.OPENAI_API_KEY;

const headers = {
  'Content-Type': 'application/json',
};

const SYSTEM_PROMPT = `
You are a helpful documentation assistant. Answer questions based on the provided documentation context.

Instructions:
1. ALWAYS use the provided documentation to answer questions.
2. If the exact information is in the docs, quote it using markdown blockquotes.
3. If information is spread across multiple sections, combine them coherently.
4. Include relevant code examples from the docs when available.
5. If the information isn't in the docs, clearly state that and suggest related topics.
6. Keep responses focused and concise.
7. Format responses using markdown for readability.
8. ALWAYS include links to relevant documentation sections.
`;

// Function to read all .md and .mdx files in a directory (and subdirectories)
async function readDocsFromDirectory(directoryPath: string): Promise<string> {
  let content = '';
  try {
    const files = await fs.readdir(directoryPath, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(directoryPath, file.name);
      if (file.isDirectory()) {
        content += await readDocsFromDirectory(fullPath);
      } else if (file.isFile() && (file.name.endsWith('.md') || file.name.endsWith('.mdx'))) {
        const fileContent = await fs.readFile(fullPath, 'utf-8');
        console.log(`Conteúdo do arquivo ${file.name}:`, fileContent);
        content += fileContent + '\n\n';
      }
    }
  } catch (error) {
    console.error(`Erro ao ler o diretório ${directoryPath}:`, error);
  }
  return content;
}

// Function to divide the content into smaller parts, so as not to exceed the token limit
function splitContent(content: string, maxTokens: number): string[] {
  const words = content.split(' ');
  const parts = [];
  let currentPart = [];
  let tokenCount = 0;

  for (const word of words) {
    tokenCount += word.length + 1;
    if (tokenCount <= maxTokens) {
      currentPart.push(word);
    } else {
      parts.push(currentPart.join(' '));
      currentPart = [word];
      tokenCount = word.length + 1;
    }
  }

  if (currentPart.length > 0) {
    parts.push(currentPart.join(' '));
  }

  return parts;
}

export const POST: APIRoute = async ({ request }) => {
  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase configuration is missing.');
    return new Response(
      JSON.stringify({
        error: 'Supabase is not configured. Please provide SUPABASE_URL and SUPABASE_ANON_KEY.',
      }),
      { status: 503, headers }
    );
  }

  if (!openaiKey) {
    console.error('OpenAI API key is missing.');
    return new Response(
      JSON.stringify({
        error: 'OpenAI API key is not configured. Please provide OPENAI_API_KEY.',
      }),
      { status: 503, headers }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const openai = new OpenAI({ apiKey: openaiKey });

  let body;
  try {
    body = await request.json();
  } catch (error) {
    console.error('Failed to parse request body:', error);
    return new Response(
      JSON.stringify({ error: 'Invalid request format.' }),
      { status: 400, headers }
    );
  }

  const { message } = body;
  if (!message || typeof message !== 'string') {
    return new Response(
      JSON.stringify({ error: 'The message is mandatory and must be a string.' }),
      { status: 400, headers }
    );
  }

  try {
    // Resolve document directory path relative to project directory
    const docsDirectoryPath = path.resolve(process.cwd(), 'src/content/docs');

    // Read all .md and .mdx contents of the documentation folder
    const docsContent = await readDocsFromDirectory(docsDirectoryPath);
    console.log("Conteúdo dos Docs:", docsContent);

    // Step 1: Search for keywords in Supabase
    const { data: keywordResults, error: keywordError } = await supabase
      .from('documents')
      .select('content, url')
      .textSearch('content', message, {
        type: 'plain',
        config: 'english',
      });

    if (keywordError) {
      console.error('Erro de pesquisa por palavra-chave:', keywordError);
    } else if (keywordResults?.length > 0) {
      // Split the docs content into smaller parts for sending
      const maxTokens = 3000;
      const docsParts = splitContent(docsContent, maxTokens);

      // Build the context including the Supabase docs and results blocks
      let context = `${SYSTEM_PROMPT}\n\nDocumentação relevante:\n\n`;
      for (const part of docsParts) {
        context += `${part}\n\n`;
      }
      context += `\nURLs de origem:\n${keywordResults
        .map((doc) => `- ${doc.url}`)
        .join('\n')}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: context },
          { role: 'user', content: message },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      return new Response(
        JSON.stringify({
          response: completion.choices[0].message.content,
          sources: keywordResults.map((doc) => doc.url),
        }),
        { headers }
      );
    }

    // If there are no search results in Supabase, generate embedding and perform vector search
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: message,
    });
    const embedding = embeddingResponse.data[0].embedding;

    // Perform vector search
    const { data: vectorResults, error: vectorError } = await supabase.rpc(
      'match_documents_vector',
      {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: 5,
      }
    );

    if (vectorError) {
      console.error('Vector search error:', vectorError);
      throw vectorError;
    }

    const documents = vectorResults || [];
    let context = `${SYSTEM_PROMPT}\n\nRelevant documentation:\n\n`;

    for (const doc of documents) {
      context += `${doc.content}\n\n`;
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: context },
        { role: 'user', content: message },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    return new Response(
      JSON.stringify({
        response: completion.choices[0].message.content,
        sources: documents.map((doc: any) => doc.url),
      }),
      { headers }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred while processing your request.' }),
      { status: 500, headers }
    );
  }
};
