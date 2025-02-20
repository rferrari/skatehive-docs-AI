import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { openaiClient } from '../config/openai.js';
import { supabaseClient } from '../config/supabase.js';
import { MarkdownLoader } from '../utils/document-loaders/markdown-loader.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function loadDocuments() {
  try {
   // 1. Load all markdown documents
    const docsPath = path.resolve(__dirname, '../../src/content/docs');
    const docs = await MarkdownLoader.loadFromDirectory(docsPath);
    
    console.log(`Found ${docs.length} documents`);

   // 2. Generate embeddings for each document
    for (const doc of docs) {
      console.log(`Processing: ${doc.url}`);
      
     // Generate embedding
      const response = await openaiClient.embeddings.create({
        model: 'text-embedding-ada-002',
        input: doc.content,
      });
      
      // 3. Insert into Supabase
      const { error } = await supabaseClient
        .from('documents')
        .insert({
          content: doc.content,
          url: doc.url,
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