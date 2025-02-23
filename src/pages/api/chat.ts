import type { APIRoute } from 'astro';
import { openaiClient } from '../../config/openai';
import { supabaseClient } from '../../config/supabase';
import { SYSTEM_PROMPT, GRADER_TEMPLATE } from '../../prompts/templates';
import { Cache } from '../../utils/cache';
import { Logger } from '../../utils/callbacks/logger';
import { MarkdownLoader } from '../../utils/document-loaders/markdown-loader';
import { TextSplitter } from '../../utils/document-transformers/text-splitter';
import { OpenAIEmbeddings } from '../../utils/embeddings/openai-embeddings';
import { ConversationMemory } from '../../utils/memory/conversation-memory';
import path from 'path';

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { cosineSimilarity } from "@langchain/core/utils/math";

// "gpt-4o-mini", 'gpt-3.5-turbo'
const CHAT_LLM_MODEL = "gpt-4o-mini";
const CHAT_LLM_TEMPERATURE = 0.5;
const CHAT_LLM__MAX_TOKENS = 500;

const GRADER_LLM_MODEL = "gpt-4o-mini";
const GRADER_LLM_TEMPERATURE = 0.1;
const GRADER_LLM__MAX_TOKENS = 500;

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
    //ignore empty messages
    // if(!message) return;

    // let embeddingsDocuments: any[] = [];

    // try {
    //   // 1. Load all markdown documents
    //   const docsPath = path.resolve(__dirname, '../../src/content/docs');
    //   const docs = await MarkdownLoader.loadFromDirectory(docsPath);

    //   const textSplitter = RecursiveCharacterTextSplitter.fromLanguage("markdown", {
    //     chunkSize: 1200,
    //     chunkOverlap: 125,
    //   });

    //   console.log(`Found ${docs.length} documents`);

    //   const documents = docs.flat().map(doc => ({
    //     pageContent: doc.content,
    //     metadata: { url: doc.url }
    //   }));
    //   const splitDocs = await textSplitter.splitDocuments(documents);

    //   // Split content using splitter
    //   // const splitDocs = docs.map(doc => ({
    //   //   ...doc,
    //   //   content: splitter.split(doc.content, 1000).join(' ') // 1000 characters per chunk
    //   // }));

    //   // 2. Generate embeddings for each document
    //   for (const doc of splitDocs) {
    //     console.log(`Processing: ${doc.metadata.url}`);

    //     // Generate embedding
    //     const response = await openaiClient.embeddings.create({
    //       model: 'text-embedding-ada-002',
    //       input: doc.pageContent,
    //     });

    //     // 3. Insert into Supabase
    //     embeddingsDocuments.push({
    //       content: doc.pageContent,
    //       url: doc.metadata.url,
    //       embedding: response.data[0].embedding
    //     });

    //   }
    // } catch (error) {

    // }

    try {
      // Check cache first
      const cacheKey = `chat_${userId}_${message}`;
      const cached = this.cache.get<{ response: string, sources: string[] }>(cacheKey);
      if (cached) {
        return cached;
      }

      const history = await this.memory.getHistory(userId);
      const docs = await this.findRelevantDocs(message);


      // const localDocs = await this.findLocalRelevantDocs(embeddingsDocuments, message);

      // Load documents using loader
      // const loadedDocs: { url: string, content: string }[] = await Promise.all(
      //   docs.map(async (doc: { url: string }) => ({
      //     ...doc,
      //     content: await this.loader.load(doc.url)
      //   }))
      // );

      // console.log("loadedDocs.length")
      // console.log(loadedDocs.length)

      const gradedDocs = await this.gradeDocs(docs, message);

      // Split content using splitter
      // const splitDocs = loadedDocs.map(doc => ({
      //   ...doc,
      //   content: this.splitter.split(doc.content, 1000).join(' ') // 1000 characters per chunk
      // }));

      // console.log("splitDocs.length")
      // console.log(splitDocs.length)

      const systemPrompt = this.createPrompt(SYSTEM_PROMPT, history, message, gradedDocs);
      console.warn("SYSTEM_PROMPT")
      console.warn(systemPrompt)

      const response = await this.generateResponse(systemPrompt, message);

      console.log("\n\nresponse")
      console.log(response)

      await this.memory.saveInteraction(userId, message, response);

      const result = {
        response,
        // sources: splitDocs.map(doc => doc.url)
      };

      // Save to cache
      this.cache.set(cacheKey, result, 3600); // Cache for 1 hour

      return result;
    } catch (error) {
      this.logger.error((error as Error).message);
      throw error;
    }
  }

  
  // async findLocalRelevantDocs(embeddingsDocuments: any[], message: string) {
  //   const messageEmbedding = await this.embeddings.createEmbedding(message);
  
  //   return embeddingsDocuments
  //     .map((doc) => ({
  //       ...doc,
  //       similarityScore: cosineSimilarity([doc.embedding], [messageEmbedding])
  //     }))
  //     .filter((doc) => doc.similarityScore > 0.5)
  //     .sort((a, b) => b.similarityScore - a.similarityScore);
  // }

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

  private async gradeDocs(docs: any[], message: string) {
    const gradingPromises = docs.map(async (doc) => {
      const gradedResponse = await this.docsGrader({
        document: doc.content,
        question: message
      });

      const parsedResponse = JSON.parse(gradedResponse.content as string);
      return parsedResponse.relevant ? doc : null;
    });

    const gradedDocs = await Promise.all(gradingPromises);
    const goodDocuments = gradedDocs.filter(Boolean);

    console.log(`----- FOUND ${goodDocuments.length} RELEVANT DOCUMENTS ------`);

    goodDocuments.forEach((doc) => {
      if (doc) {
        console.log(`- ${doc.url}`);
      }
    });

    return goodDocuments;
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

    return systemPrompt
      .replace("{history}", historyText)
      .replace("{documentation}", docsText)
    // .replace("{{message}}", message);
  }

  private async docsGrader({ document, question }: { document: string, question: string }) {
    const gradingPrompt = GRADER_TEMPLATE
      .replace("{question}", question)
      .replace("{document}", document);

    const response = await openaiClient.chat.completions.create({
      model: GRADER_LLM_MODEL,
      messages: [
        { role: 'system', content: gradingPrompt },
      ],
      temperature: GRADER_LLM_TEMPERATURE,
      max_tokens: GRADER_LLM__MAX_TOKENS
    });

    return {
      content: response.choices[0].message.content
    }
  }

  private async generateResponse(prompt: string, message: string): Promise<string> {
    const completion = await openaiClient.chat.completions.create({
      model: CHAT_LLM_MODEL,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: message }
      ],
      temperature: CHAT_LLM_TEMPERATURE,
      max_tokens: CHAT_LLM__MAX_TOKENS
    });

    return completion.choices[0].message.content ?? '';
  }
}

// API Route handler
export const POST: APIRoute = async ({ request }) => {
  const service = new ChatService();

  try {
    const { message, user_id } = await request.json();

    // ignore empty messages
    // if(!message || !user_id) {
    //   return new Response("Invalid Request: message || userid null", {
    //     headers: { 'Content-Type': 'application/json' }
    //   });
    // }


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