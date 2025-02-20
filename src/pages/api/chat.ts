import type { APIRoute } from 'astro';
import { openaiClient } from '../../config/openai';
import { supabaseClient } from '../../config/supabase';
import { SYSTEM_PROMPT } from '../../prompts/emplates';
import { Cache } from '../../utils/cache';
import { Logger } from '../../utils/callbacks/logger';
import { MarkdownLoader } from '../../utils/document-loaders/markdown-loader';
import { TextSplitter } from '../../utils/document-transformers/text-splitter';
import { OpenAIEmbeddings } from '../../utils/embeddings/openai-embeddings';
import { ConversationMemory } from '../../utils/memory/conversation-memory';

export const prerender = false;
export const output = 'server';

export class ChatService {
  private cache: Cache;
  private logger: Logger;
  private loader: MarkdownLoader;
  private splitter: TextSplitter;
  private embeddings: OpenAIEmbeddings;
  private memory: ConversationMemory;

  constructor() {
    this.cache = new Cache(); 
    this.logger = new Logger();
    this.loader = new MarkdownLoader();
    this.splitter = new TextSplitter();
    this.embeddings = new OpenAIEmbeddings(openaiClient);
    this.memory = new ConversationMemory(supabaseClient);
  }

  async processMessage(message: string, userId: string) {
    try {
     // Check cache first
      const cacheKey = `chat_${userId}_${message}`;
      const cached = this.cache.get<{response: string, sources: string[]}>(cacheKey);
      if (cached) {
        return cached;
      }

      const history = await this.memory.getHistory(userId);
      const docs = await this.findRelevantDocs(message);
      
     // Load documents using loader
      const loadedDocs: { url: string, content: string }[] = await Promise.all(
        docs.map(async (doc: { url: string }) => ({
          ...doc,
          content: await this.loader.load(doc.url)
        }))
      );

      // Split content using splitter
      const splitDocs = loadedDocs.map(doc => ({
        ...doc,
        content: this.splitter.split(doc.content, 1000).join(' ') // 1000 characters per chunk
      }));

      const prompt = this.createPrompt(SYSTEM_PROMPT, history, message, splitDocs);
      const response = await this.generateResponse(prompt);
      
      await this.memory.saveInteraction(userId, message, response);

      const result = {
        response,
        sources: splitDocs.map(doc => doc.url)
      };

      // Save to cache
      this.cache.set(cacheKey, result, 3600); // Cache for 1 hour

      return result;
    } catch (error) {
      this.logger.error((error as Error).message);
      throw error;
    }
  }

  private async findRelevantDocs(message: string) {
   // Cache embeddings
    const cacheKey = `embedding_${message}`;
    const cachedEmbedding = this.cache.get<number[]>(cacheKey);
    
    if (cachedEmbedding) {
      return this.vectorSearch(cachedEmbedding);
    }

    const embedding = await this.embeddings.createEmbedding(message);
    this.cache.set(cacheKey, embedding, 3600);
    
    return this.vectorSearch(embedding);
  }

  private async vectorSearch(embedding: number[]) {
    const { data, error } = await supabaseClient.rpc(
      'match_documents_vector',
      {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: 5
      }
    );

    if (error) throw error;
    return data || [];
  }

  private createPrompt(
    systemPrompt: string,
    history: any[],
    message: string,
    docs: any[]
  ): string {
    const historyText = history.map(item => `${item.user}: ${item.message}`).join('\n');
    const docsText = docs.map(doc => `Source: ${doc.url}\n${doc.content}`).join('\n\n');
    return `${systemPrompt}\n\nHistory:\n${historyText}\n\nMessage:\n${message}\n\nDocuments:\n${docsText}`;
  }

  private async generateResponse(prompt: string): Promise<string> {
    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.1,
      max_tokens: 500
    });

    return completion.choices[0].message.content ?? '';
  }
}

// API Route handler
export const POST: APIRoute = async ({ request }) => {
  const service = new ChatService();
  
  try {
    const { message, user_id } = await request.json();
    const result = await service.processMessage(message, user_id);
    
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};