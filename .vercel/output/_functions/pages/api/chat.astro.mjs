import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import path, { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import { cosineSimilarity } from '@langchain/core/utils/math';
export { renderers } from '../../renderers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../../.env") });
const env = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY
};
const missingVars = Object.entries(env).filter(([_, value]) => !value).map(([key]) => key);
if (missingVars.length > 0) {
  throw new Error(`Variáveis de ambiente faltando: ${missingVars.join(", ")}`);
}

const openaiClient = new OpenAI({
  apiKey: env.OPENAI_API_KEY
});

const supabaseClient = createClient(
  env.SUPABASE_URL || "",
  env.SUPABASE_ANON_KEY || ""
);

const GRADER_TEMPLATE = `
You are a grader. You are given a document and you need to evaluate the relevance of the document to the user's message.

Here is the user question:
<question>
{question}
</question>

Here is the retrieved document:
<document>
{document}
</document>

If the document contains keyword or semantic meaning related to the user question, then the document is relevant.
Return a json reponse with key "relevant" and value true, if relevant, otherwise return false. 
So the response json key should be a boolean value.
`;
const SYSTEM_PROMPT = `
You are a helpful assistant for the Skatehive documentation.

TASK: provide concise, clear, and accurate information based on the documentation provided 
and the history of conversations. 

<documentation>
   {documentation}
</documentation>

<history>
   {history}
</history>

`;

class Cache {
  constructor() {
    this.store = /* @__PURE__ */ new Map();
  }
  set(key, value, ttl) {
    this.store.set(key, {
      value,
      expires: ttl ? Date.now() + ttl * 1e3 : null
    });
  }
  get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expires && Date.now() > item.expires) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }
}

class Logger {
  info(message) {
    console.log(`[INFO] ${message}`);
  }
  error(message) {
    console.error(`[ERROR] ${message}`);
  }
}

class MarkdownLoader {
  async load(url) {
    try {
      const cached = await this.getFromDatabase(url);
      if (cached) {
        return cached;
      }
      console.warn(`Document not found in the bank: ${url}`);
      return "";
    } catch (error) {
      console.warn(`Error loading from bank: ${url}`, error);
      return "";
    }
  }
  async getFromDatabase(url) {
    const { data } = await supabaseClient.from("documents").select("content").eq("url", url).single();
    return data?.content || null;
  }
  static async loadFromDirectory(directoryPath) {
    const files = [];
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        files.push(...await this.loadFromDirectory(fullPath));
      } else if (entry.isFile() && /\.mdx?$/.test(entry.name)) {
        const content = await fs.readFile(fullPath, "utf-8");
        const url = this.generateUrl(fullPath);
        files.push({ content, url });
      }
    }
    return files;
  }
  static generateUrl(filePath) {
    const relativePath = path.relative(
      path.resolve(process.cwd(), "src/content/docs"),
      filePath
    );
    return `https://docs-ai-wheat.vercel.app/docs/${relativePath.replace(/\\/g, "/")}`;
  }
}

class TextSplitter {
  split(text, maxLength = 1e3) {
    return text.match(new RegExp(`.{1,${maxLength}}`, "g")) || [];
  }
}

class OpenAIEmbeddings {
  constructor(openai) {
    this.openai = openai;
    this.cache = new Cache();
  }
  async createEmbedding(text) {
    const cacheKey = `embedding_${text}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Array.isArray(cached)) {
      return cached;
    }
    const response = await this.openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text
    });
    const embedding = response.data[0].embedding;
    this.cache.set(cacheKey, embedding);
    return embedding;
  }
}

class ConversationMemory {
  constructor(supabase) {
    this.supabase = supabase;
  }
  async getHistory(userId) {
    const { data } = await this.supabase.from("chat_history").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(5);
    return data || [];
  }
  async saveInteraction(userId, message, response) {
    return await this.supabase.from("chat_history").insert([{ user_id: userId, message, response }]);
  }
}

const prerender = false;
const output = "server";
class ChatService {
  constructor() {
    this.cache = new Cache();
    this.logger = new Logger();
    this.loader = new MarkdownLoader();
    this.splitter = new TextSplitter();
    this.embeddings = new OpenAIEmbeddings(openaiClient);
    this.memory = new ConversationMemory(supabaseClient);
  }
  async processMessage(message, userId) {
    try {
      const cacheKey = `chat_${userId}_${message}`;
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
      const history = await this.memory.getHistory(userId);
      const docs = await this.findRelevantDocs(message);
      const gradedDocs = await this.gradeDocs(docs, message);
      const systemPrompt = this.createPrompt(SYSTEM_PROMPT, history, message, gradedDocs);
      console.warn("SYSTEM_PROMPT");
      console.warn(systemPrompt);
      const response = await this.generateResponse(systemPrompt, message);
      console.log("\n\nresponse");
      console.log(response);
      await this.memory.saveInteraction(userId, message, response);
      const result = {
        response
        // sources: splitDocs.map(doc => doc.url)
      };
      this.cache.set(cacheKey, result, 3600);
      return result;
    } catch (error) {
      this.logger.error(error.message);
      throw error;
    }
  }
  async findLocalRelevantDocs(embeddingsDocuments, message) {
    const messageEmbedding = await this.embeddings.createEmbedding(message);
    return embeddingsDocuments.map((doc) => ({
      ...doc,
      similarityScore: cosineSimilarity([doc.embedding], [messageEmbedding])
    })).filter((doc) => doc.similarityScore > 0.5).sort((a, b) => b.similarityScore - a.similarityScore);
  }
  async findRelevantDocs(message) {
    const cacheKey = `embedding_${message}`;
    const cachedEmbedding = this.cache.get(cacheKey);
    if (cachedEmbedding) {
      return this.vectorSearch(cachedEmbedding);
    }
    const embedding = await this.embeddings.createEmbedding(message);
    this.cache.set(cacheKey, embedding, 3600);
    return this.vectorSearch(embedding);
  }
  async gradeDocs(docs, message) {
    const gradingPromises = docs.map(async (doc) => {
      const gradedResponse = await this.docsGrader({
        document: doc.content,
        question: message
      });
      const parsedResponse = JSON.parse(gradedResponse.content);
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
  async vectorSearch(embedding) {
    const { data, error } = await supabaseClient.rpc(
      "match_documents_vector",
      {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: 5
      }
    );
    if (error) throw error;
    return data || [];
  }
  createPrompt(systemPrompt, history, message, docs) {
    const historyText = history.map((item) => `${item.user}: ${item.message}`).join("\n");
    const docsText = docs.map((doc) => `Source: ${doc.url}
${doc.content}`).join("\n\n");
    return systemPrompt.replace("{history}", historyText).replace("{documentation}", docsText);
  }
  async docsGrader({ document, question }) {
    const gradingPrompt = GRADER_TEMPLATE.replace("{question}", question).replace("{document}", document);
    const response = await openaiClient.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: gradingPrompt }
      ],
      temperature: 0.1,
      max_tokens: 500
    });
    return {
      content: response.choices[0].message.content
    };
  }
  async generateResponse(prompt, message) {
    const completion = await openaiClient.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: message }
      ],
      temperature: 0.1,
      max_tokens: 500
    });
    return completion.choices[0].message.content ?? "";
  }
}
const POST = async ({ request }) => {
  const service = new ChatService();
  try {
    const { message, user_id } = await request.json();
    const result = await service.processMessage(message, user_id);
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  ChatService,
  POST,
  output,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
