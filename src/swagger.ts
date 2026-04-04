export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Blue Innovation API',
    version: '1.0.0',
    description: 'REST API for Blue Innovation platform.',
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  paths: {
    // ── Auth ──────────────────────────────────────────────────────────────────
    '/api/v1/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name:        { type: 'string', example: 'Ahmed Ali' },
                  email:       { type: 'string', format: 'email', example: 'ahmed@example.com' },
                  password:    { type: 'string', minLength: 8, example: 'password123' },
                  phone:       { type: 'string', example: '+966501234567' },
                  campany:     { type: 'string', example: 'Acme Corp' },
                  industry:    { type: 'string', example: 'Technology' },
                  campanySize: { type: 'string', example: '50-100' },
                  chatVolume:  { type: 'string', example: '500+' },
                  website:     { type: 'string', example: 'https://example.com' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Confirmation email sent' },
          400: { description: 'Validation error' },
        },
      },
    },
    '/api/v1/auth/confirm-register': {
      post: {
        tags: ['Auth'],
        summary: 'Confirm registration with token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token'],
                properties: {
                  token: { type: 'string', example: 'abc123' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Registration confirmed' },
          400: { description: 'Invalid token' },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login and receive JWT',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email:    { type: 'string', format: 'email', example: 'ahmed@example.com' },
                  password: { type: 'string', example: 'password123' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Returns JWT token' },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/api/v1/auth/trailer': {
      post: {
        tags: ['Auth'],
        summary: 'Submit a trial plan request',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'phone', 'password', 'plan'],
                properties: {
                  name:          { type: 'string', example: 'Ahmed Ali' },
                  email:         { type: 'string', format: 'email', example: 'ahmed@example.com' },
                  phone:         { type: 'string', example: '+966501234567' },
                  password:      { type: 'string', example: 'password123' },
                  plan:          { type: 'string', example: 'starter' },
                  campany:       { type: 'string', example: 'Acme Corp' },
                  industry:      { type: 'string', example: 'Technology' },
                  city:          { type: 'string', example: 'Riyadh' },
                  country:       { type: 'string', example: 'Saudi Arabia' },
                  campanySize:   { type: 'string', example: '50-100' },
                  chatVolume:    { type: 'string', example: '500+' },
                  aiConnect:     { type: 'string', example: 'CRM, ERP' },
                  aiIntegration: { type: 'string', example: 'Yes' },
                  whatsapp:      { type: 'string', example: '+966501234567' },
                  website:       { type: 'string', example: 'https://example.com' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Confirmation email sent' },
          400: { description: 'Validation error or already registered' },
        },
      },
    },

    // ── QR Code / Visits ──────────────────────────────────────────────────────
    '/api/v1/qr-code': {
      post: {
        tags: ['QR Code'],
        summary: 'Create a visit and generate a QR code PDF',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: [
                  'residentFullName', 'residentUnit', 'residentPhone',
                  'visitorFullName', 'visitorCarType', 'visitorLicensePlate',
                  'visitDate', 'visitTime',
                ],
                properties: {
                  residentFullName:    { type: 'string', example: 'Mohammed Al-Otaibi' },
                  residentUnit:        { type: 'string', example: 'B-204' },
                  residentPhone:       { type: 'string', example: '+966501234567' },
                  visitorFullName:     { type: 'string', example: 'Khalid Al-Ghamdi' },
                  visitorCarType:      { type: 'string', example: 'Toyota Camry' },
                  visitorLicensePlate: { type: 'string', example: 'ABC 1234' },
                  visitDate:           { type: 'string', format: 'date', example: '2026-03-20' },
                  visitTime:           { type: 'string', pattern: '^\\d{2}:\\d{2}$', example: '14:30' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Visit created with PDF and QR code URLs' },
          400: { description: 'Validation error' },
        },
      },
    },
    '/api/v1/qr-code/{id}': {
      get: {
        tags: ['QR Code'],
        summary: 'Get visit details by ID',
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Visit ID' },
        ],
        responses: {
          200: { description: 'Visit record' },
          404: { description: 'Visit not found' },
        },
      },
    },

    // ── PDF ───────────────────────────────────────────────────────────────────
    '/pdf/{id}': {
      get: {
        tags: ['PDF'],
        summary: 'Download a generated visit PDF',
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' }, description: 'PDF file name or visit ID' },
        ],
        responses: {
          200: { description: 'PDF file stream', content: { 'application/pdf': {} } },
          404: { description: 'PDF not found' },
        },
      },
    },

    // ── Analytics ─────────────────────────────────────────────────────────────
    '/api/v1/analytics/requests/by-agent': {
      get: {
        tags: ['Analytics'],
        summary: 'Get request counts grouped by agent',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Requests by agent' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/v1/analytics/requests/status': {
      get: {
        tags: ['Analytics'],
        summary: 'Get request counts grouped by status',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Requests by status' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/v1/analytics/requests/list': {
      get: {
        tags: ['Analytics'],
        summary: 'List requests with pagination and filters',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'page',        schema: { type: 'integer', default: 1 } },
          { in: 'query', name: 'limit',       schema: { type: 'integer', default: 10, maximum: 100 } },
          { in: 'query', name: 'status',      schema: { type: 'string', enum: ['new', 'in_progress', 'completed', 'canceled'] } },
          { in: 'query', name: 'assigned_to', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Paginated request list' },
          400: { description: 'Invalid query parameters' },
          401: { description: 'Unauthorized' },
        },
      },
    },

    // ── Check Email ───────────────────────────────────────────────────────────
    '/api/v1/check-email': {
      get: {
        tags: ['User'],
        summary: 'Check if an email address is already registered',
        parameters: [
          { in: 'query', name: 'email', required: true, schema: { type: 'string', format: 'email' }, description: 'Email address to check' },
        ],
        responses: {
          200: {
            description: 'Email availability result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    available: { type: 'boolean', example: true, description: 'true if email is not in use' },
                  },
                },
              },
            },
          },
          400: { description: 'Missing email query parameter' },
        },
      },
    },

    // ── User ──────────────────────────────────────────────────────────────────
    '/api/v1/user': {
      get: {
        tags: ['User'],
        summary: 'List all users with pagination (Admin only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'page',  schema: { type: 'integer', default: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 10, maximum: 100 } },
        ],
        responses: {
          200: { description: 'Paginated list of users (password excluded)' },
          400: { description: 'Invalid query parameters' },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden – Admin only' },
        },
      },
    },
    '/api/v1/user/{id}': {
      get: {
        tags: ['User'],
        summary: 'Get a user by ID (Admin only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' }, description: 'User ID' },
        ],
        responses: {
          200: { description: 'User object (password excluded)' },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden – Admin only' },
          404: { description: 'User not found' },
        },
      },
    },
    '/api/v1/user/search': {
      get: {
        tags: ['User'],
        summary: 'Search users by name, email, or token (Admin only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'q', schema: { type: 'string' }, description: 'Search query' },
        ],
        responses: {
          200: { description: 'List of matching users (max 5)' },
          401: { description: 'Unauthorized' },
        },
      },
    },

    // ── Visitors ──────────────────────────────────────────────────────────────
    '/api/v1/visitors': {
      get: {
        tags: ['Visitors'],
        summary: 'List all visits with pagination',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'page',  schema: { type: 'integer', default: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 10, maximum: 100 } },
          { in: 'query', name: 'unit',  schema: { type: 'string' }, description: 'Filter by resident unit (partial match)' },
        ],
        responses: {
          200: { description: 'Paginated list of visits' },
          400: { description: 'Invalid query parameters' },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden – Admin only' },
        },
      },
    },
    '/api/v1/visitors/stats': {
      get: {
        tags: ['Visitors'],
        summary: 'Get visitor statistics (total, per compound, last 7 days, today)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Visitor statistics',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    total: { type: 'integer', example: 320 },
                    perCompound: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          unit:  { type: 'string', example: 'B-204' },
                          count: { type: 'integer', example: 45 },
                        },
                      },
                    },
                    last7Days: {
                      type: 'object',
                      properties: {
                        total: { type: 'integer', example: 58 },
                        perCompound: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              unit:  { type: 'string', example: 'B-204' },
                              count: { type: 'integer', example: 12 },
                            },
                          },
                        },
                      },
                    },
                    today: {
                      type: 'object',
                      properties: {
                        total: { type: 'integer', example: 9 },
                        perCompound: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              unit:  { type: 'string', example: 'A-101' },
                              count: { type: 'integer', example: 3 },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden – Admin only' },
        },
      },
    },

    // ── Contact ───────────────────────────────────────────────────────────────
    '/api/v1/contact': {
      post: {
        tags: ['Contact'],
        summary: 'Send a contact / inquiry message',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'phone', 'volume'],
                properties: {
                  name:    { type: 'string', example: 'Ahmed Ali' },
                  email:   { type: 'string', format: 'email', example: 'ahmed@example.com' },
                  phone:   { type: 'string', example: '+966501234567' },
                  volume:  { type: 'string', example: '500+' },
                  website: { type: 'string', example: 'https://example.com' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Message sent successfully' },
          400: { description: 'Validation error' },
        },
      },
    },
  },
};
