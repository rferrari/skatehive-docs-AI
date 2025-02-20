import OpenAI from 'openai';
import { Cache } from '../cache';

export class OpenAIEmbeddings {
  private cache: Cache;
  
  constructor(private openai: OpenAI) {
    this.cache = new Cache();
  }

  async createEmbedding(text: string): Promise<number[]> {
    const cacheKey = `embedding_${text}`;
    const cached = this.cache.get<number[]>(cacheKey);
    
    if (cached && Array.isArray(cached)) {
      return cached;
    }

    const response = await this.openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });

    const embedding = response.data[0].embedding;
    this.cache.set<number[]>(cacheKey, embedding);
    
    return embedding;
  }
}