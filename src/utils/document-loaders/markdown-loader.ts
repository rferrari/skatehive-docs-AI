import fs from 'fs/promises';
import path from 'path';
import { supabaseClient } from '../../config/supabase';

interface MarkdownFile {
  content: string;
  url: string;
}

export class MarkdownLoader {
  async load(url: string): Promise<string> {
    try {
      // First try to fetch from the bank
      const cached = await this.getFromDatabase(url);
      if (cached) {
        return cached;
      }

      // If not found in the database, do not try to load URL
      console.warn(`Document not found in the bank: ${url}`);
      return '';

      // Removed fetch code from URL since we only want to use database data    
    } catch (error) {
      console.warn(`Error loading from bank: ${url}`, error);
      return '';
    }
  }

  private async getFromDatabase(url: string): Promise<string | null> {
    const { data } = await supabaseClient
      .from('documents')
      .select('content')
      .eq('url', url)
      .single();

    return data?.content || null;
  }

  static async loadFromDirectory(directoryPath: string): Promise<MarkdownFile[]> {
    const files: MarkdownFile[] = [];
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.loadFromDirectory(fullPath)));
      } else if (entry.isFile() && /\.mdx?$/.test(entry.name)) {
        const content = await fs.readFile(fullPath, 'utf-8');
        const url = this.generateUrl(fullPath);
        files.push({ content, url });
      }
    }

    return files;
  }

  private static generateUrl(filePath: string): string {
    const relativePath = path.relative(
      path.resolve(process.cwd(), 'src/content/docs'),
      filePath
    );
    return `https://docs-ai-wheat.vercel.app/docs/${relativePath.replace(/\\/g, '/')}`;
  }
}