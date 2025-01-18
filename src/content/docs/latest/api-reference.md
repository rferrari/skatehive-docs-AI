---
title: API Reference
description: Complete API documentation for developers
version: latest
order: 3
---

# API Reference

Complete documentation for our REST API endpoints.

## Authentication

All API requests require authentication using Bearer tokens:

```bash
Authorization: Bearer your_api_token
```

## Endpoints

### Users

#### GET /api/users

List all users:

```bash
curl -H "Authorization: Bearer token" https://api.example.com/users
```

#### POST /api/users

Create a new user:

```bash
curl -X POST \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com"}' \
  https://api.example.com/users
```

### Products

#### GET /api/products

List all products:

```bash
curl -H "Authorization: Bearer token" https://api.example.com/products
```