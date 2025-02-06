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
You are a helpful assistant for the Skatehive documentation. Your task is to provide concise, clear, and accurate information based on the documentation provided. Please follow these instructions carefully:

Instructions:
1. **Always use the provided documentation to answer questions.**
   - If the information is found in the docs, use it directly.
   - When quoting from the documentation, use Markdown blockquotes to clearly differentiate the quoted text.
   
2. **If information is spread across multiple sections**, summarize it coherently in your own words, highlighting the key points.
   
3. **Provide relevant code examples** whenever applicable, as shown in the documentation. Code should be formatted properly for clarity.

4. **Be clear if information is not available in the documentation**. Politely let the user know that the information is not found in the docs.

5. **Keep responses concise and to the point**. Avoid unnecessary details unless they add value to the answer. Focus on the most important information first.

6. **Use Markdown for formatting** to improve readability:
   - Use bullet points for lists.
   - Use headers for important sections.
   - Code blocks should be used for technical examples.
   
7. **Do NOT include direct links to documentation**.
   - Instead of providing links, suggest the user consult the official Skatehive documentation for further details.

8. **Respond in the same language as the user**.
   - If the user writes in Portuguese, respond in Portuguese.
   - If the user writes in English, respond in English.
   - If the user writes in Spanish, respond in Spanish.
   - Adapt the tone to match the language used.

9. **Avoid repeating the same information multiple times in different languages**. Stick to one language per answer.

10. **Translate technical terms** when possible. If a technical term does not have a direct translation, explain its meaning in the user's language. For example, you can describe "curation trail" as a way to automatically follow and vote based on another user's actions in the Skatehive platform.

11. **Clarify concepts where needed**. If something might be unclear or confusing, provide additional context or examples to help the user understand.

12. **When dealing with vague or open-ended questions**, try to ask the user for clarification or provide a general overview based on the context. It's important to guide the conversation towards concrete answers.

13. **Ensure that all technical responses are accurate**. Verify that any coding examples or commands you provide are correct and follow the best practices described in the documentation.

14. **Be polite and helpful**. Always maintain a positive, encouraging tone, and make the user feel comfortable asking follow-up questions.
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
        console.log(`File content ${file.name}:`, fileContent);
        content += fileContent + '\n\n';
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${directoryPath}:`, error);
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
    console.log("Docs Contents:", docsContent);

    // Step 1: Search for keywords in Supabase
    const { data: keywordResults, error: keywordError } = await supabase
      .from('documents')
      .select('content, url')
      .textSearch('content', message, {
        type: 'plain',
        config: 'english',
      });

    if (keywordError) {
      console.error('Keyword search error:', keywordError);
    } else if (keywordResults?.length > 0) {
      // Split the docs content into smaller parts for sending
      const maxTokens = 3000;
      const docsParts = splitContent(docsContent, maxTokens);

      // Build the context including the Supabase docs and results blocks
      let context = `${SYSTEM_PROMPT}\n\nProvided Documentation:\n\n`;
      for (const part of docsParts) {
        context += `${part}\n\n`;
      }
      context += `\nSource URLs:\n${keywordResults
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
    let context = `${SYSTEM_PROMPT}\n\nProvided Documentation:\n\n`;

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
