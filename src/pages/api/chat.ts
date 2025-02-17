import { createClient } from '@supabase/supabase-js';
import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import OpenAI from 'openai';
import path from 'path';

export const prerender = false;
export const output = 'server';

type RequestBody = {
  message: string;
  user_id: string;
};

// Initialize environment variables
const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseKey = import.meta.env.SUPABASE_ANON_KEY;
const openaiKey = import.meta.env.OPENAI_API_KEY;

const headers = {
  'Content-Type': 'application/json',
};

const SYSTEM_PROMPT = `
You are a helpful assistant for the Skatehive documentation. Your task is to provide concise, clear, and accurate information based on the documentation provided and the history of conversations with users. Please follow these instructions carefully:

Instructions:
1. **Always use the provided documentation and the chat history to answer questions.**
   - If the information is found in the docs, use it directly.
   - When quoting from the documentation, use Markdown blockquotes to clearly differentiate the quoted text.
   - Consider previous interactions (chat history) when responding, to maintain context and relevance in the conversation.

2. **If information is spread across multiple sections**, summarize it coherently in your own words, highlighting the key points.

3. **Provide relevant code examples** whenever applicable, as shown in the documentation. Code should be formatted properly for clarity.

4. **Be clear if information is not available in the documentation or chat history**. Politely let the user know that the information is not found in the docs or past conversations.

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

15. **Prioritize the most relevant or recent information** when multiple sections of the documentation provide similar content.

16. **Handle conflicting information carefully**. If different sections of the documentation contradict each other, summarize the discrepancies and recommend the most up-to-date or widely accepted interpretation.

17. **Avoid speculation if the documentation lacks information**. If a topic is not covered, inform the user rather than making assumptions.

18. **Maintain context awareness**. If the user has asked previous related questions, try to understand their preferences and provide responses tailored to their needs based on past conversations.
   - Keep track of common queries and learn from them to provide quicker and more accurate responses.
   - Ensure that the most recent interactions are included in your context to maintain continuity in the conversation.

19. **Use chat history to personalize responses**: 
   - If the user has had previous interactions, try to understand their preferences and provide responses tailored to their needs based on past conversations.
   - As you interact with the user, build a richer understanding of their needs and past inquiries to improve the accuracy and relevance of your responses.
`;

// Function to read all .md and .mdx files in a directory (and subdirectories)
async function readDocsFromDirectory(directoryPath: string): Promise<{ content: string; url: string }[]> {
  const files: { content: string; url: string }[] = [];
  try {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await readDocsFromDirectory(fullPath)));
      } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))) {
        const fileContent = await fs.readFile(fullPath, 'utf-8');
        const relativePath = path.relative(path.resolve(process.cwd(), 'src/content/docs'), fullPath);
        const url = `https://docs-ai-wheat.vercel.app/docs/${relativePath.replace(/\\/g, '/')}`;
        files.push({ content: fileContent, url });
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${directoryPath}:`, error);
  }
  return files;
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

async function createEmbeddings(openai: OpenAI, texts: string[]): Promise<number[][]> {
  const embeddingResponses = await Promise.all(
    texts.map(async (text) => {
      const response = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
      });
      return response.data[0].embedding;
    })
  );
  return embeddingResponses;
}

async function storeVectors(supabase: any, vectors: number[][], contents: string[], urls: string[]) {
  const data = vectors.map((vector, index) => ({
    content: contents[index],
    url: urls[index],
    embedding: vector,
  }));

  // Filter out any documents that do not have a URL
  const filteredData = data.filter(doc => doc.url);

  const { data: insertData, error } = await supabase.from('documents').insert(filteredData);
  if (error) {
    console.error('Error storing vectors:', error);
  }
  return insertData;
}

async function fetchChatHistory(supabase: any, user_id: string) {
  const { data: chatHistory, error } = await supabase
    .from('chat_history')
    .select('message, response')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error fetching chat history:', error);
  }

  return chatHistory || [];
}

function createPrompt(systemPrompt: string, chatHistory: { message: string; response: string }[], userMessage: string, matchedDocs: { content: string; url: string }[]): string {
  let historyContext = '';
  if (chatHistory && chatHistory.length > 0) {
    historyContext = '\n\nConversation History:\n';
    for (const chat of chatHistory) {
      historyContext += `User: ${chat.message}\nIA: ${chat.response}\n\n`;
    }
  }

  let documentationContext = '';
  if (matchedDocs && matchedDocs.length > 0) {
    documentationContext = '\n\nDocumentation:\n';
    for (const doc of matchedDocs) {
      documentationContext += `${doc.content}\n\n`;
    }
  }

  return `${systemPrompt}\n\n${historyContext}\n${documentationContext}\nUser: ${userMessage}`;
}

async function generateResponse(openai: OpenAI, prompt: string) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: prompt },
    ],
    temperature: 0.1,
    max_tokens: 500,
  });

  return completion.choices[0].message.content;
}

async function saveInteraction(supabase: any, user_id: string, message: string, response: string) {
  const { data, error } = await supabase.from('chat_history').insert([
    { message, response, user_id },
  ]);

  if (error) {
    console.error('Error saving interaction:', error);
  }

  return data;
}

async function initializeDocumentation(supabase: any, openai: OpenAI) {
  const docs = await readDocsFromDirectory(path.resolve(process.cwd(), 'src/content/docs'));
  const contents = docs.map(doc => doc.content);
  const urls = docs.map(doc => doc.url);

  const maxTokens = 500;
  const parts = contents.flatMap(content => splitContent(content, maxTokens));

  const embeddings = await createEmbeddings(openai, parts);
  await storeVectors(supabase, embeddings, parts, urls);
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
      JSON.stringify({ error: 'OpenAI API key is not configured. Please provide OPENAI_API_KEY.' }),
      { status: 503, headers }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const openai = new OpenAI({ apiKey: openaiKey });

  // Initialize documentation on server start
  await initializeDocumentation(supabase, openai);

  let body: RequestBody | null = null;

  try {
    if (request.headers.get('Content-Type') !== 'application/json') {
      console.error('Request is not of type application/json');
      return new Response(
        JSON.stringify({ error: 'Request must be of type application/json.' }),
        { status: 400, headers }
      );
    }

    const text = await request.text();
    if (!text) {
      console.error('Request body is empty');
      return new Response(
        JSON.stringify({ error: 'Request body is empty.' }),
        { status: 400, headers }
      );
    }

    body = JSON.parse(text);
  } catch (error) {
    console.error('Failed to parse request body:', error);
    return new Response(
      JSON.stringify({ error: 'Invalid request format.' }),
      { status: 400, headers }
    );
  }

  const { message, user_id } = body;
  if (!body || !body.message || typeof body.message !== 'string') {
    return new Response(
      JSON.stringify({ error: 'The message is mandatory and must be a string.' }),
      { status: 400, headers }
    );
  }

  try {
    // Fetch user's recent history in Supabase
    const chatHistory = await fetchChatHistory(supabase, user_id);

    // Step 1: Search for keywords in Supabase
    const { data: keywordResults, error: keywordError } = await supabase
      .from('documents')
      .select('content, url')
      .textSearch('content', message, {
        type: 'plain',
        config: 'english',
      });

    let matchedDocs: { content: string; url: string }[] = [];

    if (keywordError) {
      console.error('Keyword search error:', keywordError);
      // Fallback to vector search if keyword search fails
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

      matchedDocs = vectorResults || [];
    } else {
      console.log("Keyword Search Results:", keywordResults);

      // Filter the docs to only include those that match the keywords
      matchedDocs = keywordResults || [];
    }

    if (matchedDocs.length === 0) {
      console.warn('No documents matched the search criteria.');
    }

    const prompt = createPrompt(SYSTEM_PROMPT, chatHistory, message, matchedDocs);
    const response = await generateResponse(openai, prompt);

    // Save the interaction in Supabase
    await saveInteraction(supabase, user_id, message, response);

    return new Response(
      JSON.stringify({
        response: response,
        sources: matchedDocs.map(doc => doc.url),
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