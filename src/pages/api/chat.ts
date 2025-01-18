import { createClient } from '@supabase/supabase-js';
import type { APIRoute } from 'astro';
import OpenAI from 'openai';
export const prerender = false;
export const output = 'server';
// Initialize clients
const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseKey = import.meta.env.SUPABASE_ANON_KEY;
const openaiKey = import.meta.env.OPENAI_API_KEY;

const headers = {
  'Content-Type': 'application/json'
};

const SYSTEM_PROMPT = `You are a helpful documentation assistant. Answer questions based on the provided documentation context.

Instructions:
1. ALWAYS use the provided documentation to answer questions
2. If the exact information is in the docs, quote it using markdown blockquotes
3. If information is spread across multiple sections, combine them coherently
4. Include relevant code examples from the docs when available
5. If the information isn't in the docs, clearly state that and suggest related topics
6. Keep responses focused and concise
7. Format responses using markdown for readability
8. ALWAYS include links to relevant documentation sections`;

export const POST: APIRoute = async ({ request }) => {
  try {
    // Validate environment variables
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase configuration. Please connect to Supabase.');
      return new Response(
        JSON.stringify({ 
          error: 'Supabase is not configured. Please click the "Connect to Supabase" button in the top right.' 
        }), 
        { status: 503, headers }
      );
    }

    if (!openaiKey) {
      console.error('Missing OpenAI API key.');
      return new Response(
        JSON.stringify({ 
          error: 'OpenAI API key is not configured. Please add OPENAI_API_KEY to your environment variables.' 
        }), 
        { status: 503, headers }
      );
    }

    // Initialize clients
    const supabase = createClient(supabaseUrl, supabaseKey);
    const openai = new OpenAI({ apiKey: openaiKey });

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (e) {
      console.error('Failed to parse request body:', e);
      return new Response(
        JSON.stringify({ error: 'Invalid request format' }), 
        { status: 400, headers }
      );
    }

    if (!body?.message || typeof body.message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Message is required and must be a string' }), 
        { status: 400, headers }
      );
    }

    const { message } = body;

    // First try keyword search for better exact matches
    try {
      const { data: keywordResults, error: keywordError } = await supabase
        .from('documents')
        .select('content, url')
        .textSearch('content', message.split(' ').join(' & '), {
          type: 'plain',
          config: 'english'
        });

      if (keywordError) {
        console.error('Keyword search error:', keywordError);
      } else if (keywordResults && keywordResults.length > 0) {
        const context = keywordResults.map(doc => doc.content).join('\n\n');
        const contextMessage = `${SYSTEM_PROMPT}\n\nRelevant documentation:\n\n${context}\n\nSource URLs:\n${keywordResults.map(doc => `- ${doc.url}`).join('\n')}`;
        
        const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: contextMessage },
            { role: 'user', content: message }
          ],
          temperature: 0.7, // Slightly creative but still focused
          max_tokens: 1000, // Allow for detailed responses
        });

        return new Response(
          JSON.stringify({
            response: completion.choices[0].message.content,
            sources: keywordResults.map(doc => doc.url)
          }),
          { headers }
        );
      }
    } catch (error) {
      console.error('Error during keyword search:', error);
      // Continue to vector search
    }

    // Generate embedding for vector search
    let embedding;
    try {
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: message,
      });
      embedding = embeddingResponse.data[0].embedding;
    } catch (error) {
      console.error('OpenAI embedding error:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to process your query. Please try again or rephrase your question.' 
        }), 
        { status: 500, headers }
      );
    }

    // Perform vector search
    let documents;
    try {
      const { data, error: searchError } = await supabase.rpc('match_documents_vector', {
        query_embedding: embedding,
        match_threshold: 0.5, // Adjust threshold for better matches
        match_count: 5, // Get more potential matches
      });

      if (searchError) {
        console.error('Vector search error:', searchError);
        throw searchError;
      }
      documents = data || [];
    } catch (error) {
      console.error('Vector search error:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to search documentation. Please ensure your Supabase database is properly set up.' 
        }), 
        { status: 500, headers }
      );
    }

    // Generate response
    try {
      let contextMessage;
      if (documents.length > 0) {
        const context = documents
          .map((doc: any) => doc.content)
          .join('\n\n');
        contextMessage = `${SYSTEM_PROMPT}\n\nRelevant documentation:\n\n${context}\n\nSource URLs:\n${documents.map((doc: any) => `- ${doc.url}`).join('\n')}`;
      } else {
        contextMessage = `${SYSTEM_PROMPT}\n\nNo exact matches found in the documentation. Please provide a general response and suggest checking related topics.`;
      }

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: contextMessage },
          { role: 'user', content: message }
        ],
        temperature: 0.7, // Slightly creative but still focused
        max_tokens: 1000, // Allow for detailed responses
      });

      return new Response(
        JSON.stringify({
          response: completion.choices[0].message.content,
          sources: documents.map((doc: any) => doc.url)
        }),
        { headers }
      );
    } catch (error) {
      console.error('OpenAI completion error:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to generate a response. Please try again.' 
        }), 
        { status: 500, headers }
      );
    }

  } catch (error) {
    console.error('Unexpected error in chat endpoint:', error);
    return new Response(
      JSON.stringify({ 
        error: 'An unexpected error occurred. Please try again later.' 
      }), 
      { status: 500, headers }
    );
  }
}