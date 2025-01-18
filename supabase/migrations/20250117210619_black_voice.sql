/*
  # Add test documentation records

  1. Changes
    - Add sample documents with realistic metadata
    - Include varied document types and states
    - Add embeddings for vector search
*/

-- Insert test documents
insert into documents (content, url, embedding) values
(
  E'# Service Level Agreement (SLA)\n\nThis Service Level Agreement (SLA) outlines the terms and conditions for service delivery between Provider and Client.\n\n## Service Availability\n- Target uptime: 99.9%\n- Scheduled maintenance windows\n- Incident response times\n\n## Support Levels\n- Standard support: 9am-5pm business days\n- Premium support: 24/7 coverage\n- Critical incident response: Within 1 hour',
  '/docs/legal/service-level-agreement',
  '[0.12, 0.34, 0.56]'::vector(1536)
),
(
  E'# Q4 2023 Financial Report\n\nQuarterly financial performance analysis for Q4 2023.\n\n## Key Metrics\n- Revenue: $2.5M\n- Growth: 15% YoY\n- Customer acquisition cost: $250\n- Churn rate: 2.1%\n\n## Highlights\n- Exceeded revenue targets by 8%\n- Launched 2 new product features\n- Expanded to 3 new markets',
  '/docs/finance/q4-2023-report',
  '[0.23, 0.45, 0.67]'::vector(1536)
),
(
  E'# Project Proposal: Cloud Migration\n\nProposal for migrating legacy systems to cloud infrastructure.\n\n## Objectives\n- Reduce operational costs by 30%\n- Improve system scalability\n- Enhance disaster recovery capabilities\n\n## Timeline\n- Phase 1: Assessment (2 months)\n- Phase 2: Migration (6 months)\n- Phase 3: Optimization (3 months)',
  '/docs/projects/cloud-migration-proposal',
  '[0.34, 0.56, 0.78]'::vector(1536)
),
(
  E'# Invoice #2024-001\n\nBilling details for January 2024 services.\n\n## Services Rendered\n- Cloud hosting: $1,200\n- Support hours: 15 hrs @ $150/hr\n- License fees: $500\n\nTotal Amount: $3,950\nDue Date: January 31, 2024',
  '/docs/finance/invoices/2024-001',
  '[0.45, 0.67, 0.89]'::vector(1536)
),
(
  E'# API Documentation v2.1\n\nComprehensive guide for the REST API endpoints.\n\n## Authentication\n- OAuth 2.0 implementation\n- Token management\n- Rate limiting\n\n## Endpoints\n- /users\n- /products\n- /orders\n\n## Response Formats\n- JSON structure\n- Error handling\n- Pagination',
  '/docs/technical/api-documentation',
  '[0.56, 0.78, 0.90]'::vector(1536)
),
(
  E'# Employee Handbook 2024\n\nCompany policies and procedures for all employees.\n\n## Sections\n- Code of conduct\n- Benefits and compensation\n- Work schedules\n- Remote work policy\n\n## Updates\n- Updated parental leave policy\n- New mental health benefits\n- Revised travel policy',
  '/docs/hr/employee-handbook-2024',
  '[0.67, 0.89, 0.12]'::vector(1536)
),
(
  E'# Product Roadmap 2024\n\nStrategic product development plan for 2024.\n\n## Q1 Objectives\n- AI feature integration\n- Mobile app redesign\n- Performance optimization\n\n## Q2 Objectives\n- Enterprise SSO\n- Advanced analytics\n- API v3 development',
  '/docs/product/roadmap-2024',
  '[0.78, 0.90, 0.23]'::vector(1536)
);