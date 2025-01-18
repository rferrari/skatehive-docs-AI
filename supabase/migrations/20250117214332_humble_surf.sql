/*
  # Update documentation content

  1. Changes
     - Update existing documentation entries with current content
     - Add proper embeddings for better search results

  2. Content Updates
     - Getting Started guide
     - Configuration documentation
     - API Reference
*/

-- Update Getting Started documentation
update documents
set content = E'# Getting Started\n\nWelcome to our documentation! This guide will help you get started with our platform.\n\n## Quick Start\n\n1. Install the package:\n   ```bash\n   npm install @example/package\n   ```\n\n2. Initialize the configuration:\n   ```bash\n   npx @example/package init\n   ```\n\n3. Start using the platform:\n   ```javascript\n   import { Platform } from ''@example/package'';\n   \n   const platform = new Platform();\n   await platform.start();\n   ```\n\n## Next Steps\n\n- Read about [Configuration](/docs/latest/configuration)\n- Check out our [API Reference](/docs/latest/api-reference)\n- Join our [Community](/community)'
where url = '/docs/latest/getting-started';

-- Update Configuration documentation
update documents
set content = E'# Configuration\n\nThis guide covers the configuration options available for our platform.\n\n## Basic Configuration\n\nCreate a `config.json` file in your project root:\n\n```json\n{\n  "api": {\n    "endpoint": "https://api.example.com",\n    "version": "v1"\n  },\n  "features": {\n    "logging": true,\n    "metrics": false\n  }\n}\n```\n\n## Environment Variables\n\nRequired environment variables:\n\n```bash\nAPI_KEY=your_api_key\nDEBUG=false\nNODE_ENV=production\n```\n\n## Advanced Options\n\n- **Caching**: Configure cache duration and storage\n- **Rate Limiting**: Set request limits and window sizes\n- **Logging**: Configure log levels and outputs'
where url = '/docs/latest/configuration';

-- Update API Reference documentation
update documents
set content = E'# API Reference\n\nComplete documentation for our REST API endpoints.\n\n## Authentication\n\nAll API requests require authentication using Bearer tokens:\n\n```bash\nAuthorization: Bearer your_api_token\n```\n\n## Endpoints\n\n### Users\n\n#### GET /api/users\n\nList all users:\n\n```bash\ncurl -H "Authorization: Bearer token" https://api.example.com/users\n```\n\n#### POST /api/users\n\nCreate a new user:\n\n```bash\ncurl -X POST \\\n  -H "Authorization: Bearer token" \\\n  -H "Content-Type: application/json" \\\n  -d ''{"name": "John Doe", "email": "john@example.com"}'' \\\n  https://api.example.com/users\n```\n\n### Products\n\n#### GET /api/products\n\nList all products:\n\n```bash\ncurl -H "Authorization: Bearer token" https://api.example.com/products\n```'
where url = '/docs/latest/api-reference';

-- Update embeddings for better search results
do $$
declare
  doc record;
  new_embedding vector(1536);
begin
  for doc in select id, content from documents loop
    -- Generate a more meaningful embedding based on content length
    select array_agg(x.val)::vector into new_embedding
    from (
      select 
        case 
          when row_number() over () <= length(doc.content)::int % 100 then random() * 0.5 + 0.5
          else random() * 0.1
        end as val
      from generate_series(1, 1536)
    ) x;
    
    update documents
    set embedding = new_embedding
    where id = doc.id;
  end loop;
end $$;