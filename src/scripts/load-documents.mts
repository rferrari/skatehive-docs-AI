import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { openaiClient } from '../config/openai.js';
import { supabaseClient } from '../config/supabase.js';
import { MarkdownLoader } from '../utils/document-loaders/markdown-loader.js';
import { TextSplitter } from '../utils/document-transformers/text-splitter.js';
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function loadDocuments() {
  let splitter: TextSplitter = new TextSplitter();

  try {
    // 1. Load all markdown documents
    const docsPath = path.resolve(__dirname, '../../src/content/docs');
    const docs = await MarkdownLoader.loadFromDirectory(docsPath);

    const textSplitter = RecursiveCharacterTextSplitter.fromLanguage("markdown", {
      chunkSize: 1200,
      chunkOverlap: 125,
    });

    console.log(`Found ${docs.length} documents`);

    const documents = docs.flat().map(doc => ({
      pageContent: doc.content,
      metadata: { url: doc.url }
    }));
    const splitDocs = await textSplitter.splitDocuments(documents);

    // Split content using splitter
    // const splitDocs = docs.map(doc => ({
    //   ...doc,
    //   content: splitter.split(doc.content, 1000).join(' ') // 1000 characters per chunk
    // }));

    // 2. Generate embeddings for each document
    for (const doc of splitDocs) {
      console.log(`Processing: ${doc.metadata.url}`);

      // Generate embedding
      const response = await openaiClient.embeddings.create({
        model: 'text-embedding-ada-002',
        input: doc.pageContent,
      });

      // 3. Insert into Supabase
      const { error } = await supabaseClient
        .from('documents')
        .insert({
          content: doc.pageContent,
          url: doc.metadata.url,
          embedding: response.data[0].embedding
        });

      if (error) {
        console.error(`Error inserting document: ${error.message}`);
      }
    }

    console.log('Documents uploaded successfully!');
  } catch (error) {
    console.error('Erro:', error);
  }
}

// Run the script
loadDocuments();