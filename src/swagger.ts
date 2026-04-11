const bearerAuth = [{ bearerAuth: [] }];
const adminNote  = 'Requires ADMIN role JWT.';
const ownerNote  = 'Requires OWNER role JWT.';
const authNote   = 'Requires any valid JWT.';

// ── Reusable inline schemas ───────────────────────────────────────────────────

const PaginationSchema = {
  type: 'object',
  properties: {
    page:       { type: 'integer', example: 1 },
    limit:      { type: 'integer', example: 10 },
    total:      { type: 'integer', example: 100 },
    totalPages: { type: 'integer', example: 10 },
  },
};

const ValidationError = {
  description: 'Validation failed',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Validation failed' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field:   { type: 'string', example: 'email' },
                message: { type: 'string', example: 'Invalid email' },
              },
            },
          },
        },
      },
    },
  },
};

export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Blue Innovation API',
    version: '2.0.0',
    description: 'REST API for Blue Innovation platform.',
  },
  tags: [
    { name: 'Auth',                 description: 'Registration, confirmation, login' },
    { name: 'User',                 description: 'User management (Admin)' },
    { name: 'Member',               description: 'Owner manages their team members' },
    { name: 'Compound',             description: 'Compound management (Admin)' },
    { name: 'Unit',                 description: 'Unit management (Admin)' },
    { name: 'Visitors',             description: 'Visit records' },
    { name: 'Subscription Request', description: 'Pre-registration subscription requests' },
    { name: 'Analytics',            description: 'SRS analytics' },
    { name: 'QR Code',              description: 'QR code generation' },
    { name: 'PDF',                  description: 'PDF downloads' },
    { name: 'Contact',              description: 'Contact / inquiry form' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      // ── Shared ──────────────────────────────────────────────────────────────
      Pagination: PaginationSchema,

      // ── Compound ────────────────────────────────────────────────────────────
      Compound: {
        type: 'object',
        properties: {
          id:        { type: 'string', format: 'uuid' },
          name:      { type: 'string', example: 'Green Valley' },
          slug:      { type: 'string', example: 'COMP_green_valley' },
          ownerId:   { type: 'string', format: 'uuid' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      CompoundDetail: {
        allOf: [
          { $ref: '#/components/schemas/Compound' },
          {
            type: 'object',
            properties: {
              owner: {
                type: 'object',
                properties: {
                  id:    { type: 'string' },
                  name:  { type: 'string' },
                  email: { type: 'string' },
                },
              },
              units: {
                type: 'array',
                items: { $ref: '#/components/schemas/Unit' },
              },
              guards: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    assignedAt: { type: 'string', format: 'date-time' },
                    guard: {
                      type: 'object',
                      properties: {
                        id:    { type: 'string' },
                        name:  { type: 'string' },
                        email: { type: 'string' },
                        role:  { type: 'string', example: 'GUARD' },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },

      // ── Unit ────────────────────────────────────────────────────────────────
      Unit: {
        type: 'object',
        properties: {
          id:         { type: 'string', format: 'uuid' },
          name:       { type: 'string', example: 'Tower A – 101' },
          slug:       { type: 'string', example: 'UNIT_tower_a_101' },
          compoundId: { type: 'string', format: 'uuid' },
          createdAt:  { type: 'string', format: 'date-time' },
        },
      },

      // ── Member ──────────────────────────────────────────────────────────────
      Member: {
        type: 'object',
        properties: {
          id:        { type: 'string', format: 'uuid' },
          name:      { type: 'string', example: 'Khalid Guard' },
          email:     { type: 'string', format: 'email' },
          phone:     { type: 'string', example: '+966501234567' },
          role:      { type: 'string', enum: ['GUARD'], example: 'GUARD' },
          ownerId:   { type: 'string', format: 'uuid' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },

      // ── Visit ───────────────────────────────────────────────────────────────
      Visit: {
        type: 'object',
        properties: {
          id:                  { type: 'string', format: 'uuid' },
          residentFullName:    { type: 'string', example: 'Ahmed Salem' },
          residentUnit:        { type: 'string', example: 'UNIT_tower_a_101', description: 'Unit slug' },
          residentPhone:       { type: 'string', example: '+966501234567' },
          visitorFullName:     { type: 'string', example: 'Mohammed Ali' },
          visitorCarType:      { type: 'string', example: 'Toyota Camry' },
          visitorLicensePlate: { type: 'string', example: 'ABC 1234' },
          visitDate:           { type: 'string', format: 'date-time' },
          visitTime:           { type: 'string', example: '14:30' },
          compound:            { type: 'string', example: 'COMP_green_valley', description: 'Compound slug', nullable: true },
          pdfUrl:              { type: 'string', nullable: true },
          qrCode:              { type: 'string', nullable: true },
          isExpired:           { type: 'boolean' },
          createdAt:           { type: 'string', format: 'date-time' },
          updatedAt:           { type: 'string', format: 'date-time' },
          compoundRef: {
            nullable: true,
            type: 'object',
            properties: {
              id:   { type: 'string' },
              name: { type: 'string' },
              slug: { type: 'string' },
            },
          },
          residentUnitRef: {
            nullable: true,
            type: 'object',
            properties: {
              id:   { type: 'string' },
              name: { type: 'string' },
              slug: { type: 'string' },
            },
          },
        },
      },

      // ── Subscription Request ─────────────────────────────────────────────────
      SubscriptionRequest: {
        type: 'object',
        properties: {
          id:               { type: 'string', format: 'uuid' },
          name:             { type: 'string' },
          email:            { type: 'string', format: 'email' },
          campany:          { type: 'string', nullable: true },
          industry:         { type: 'string', nullable: true },
          city:             { type: 'string', nullable: true },
          country:          { type: 'string', nullable: true },
          totalBranches:    { type: 'string', nullable: true },
          chatVolume:       { type: 'string', nullable: true },
          aiIntegration:    { type: 'string', nullable: true },
          campanySize:      { type: 'string', nullable: true },
          website:          { type: 'string', nullable: true },
          phone:            { type: 'string', nullable: true },
          whatsapp:         { type: 'string', nullable: true },
          campanyRole:      { type: 'string' },
          plan:             { type: 'string' },
          confirmed:        { type: 'boolean' },
          acceptedTerms:    { type: 'boolean' },
          acceptedAuthorize:{ type: 'boolean' },
          createdAt:        { type: 'string', format: 'date-time' },
        },
      },

      // ── SRS ─────────────────────────────────────────────────────────────────
      SrsRow: {
        type: 'object',
        properties: {
          name:             { type: 'string', example: 'Plumbing' },
          value:            { type: 'integer', example: 42 },
          Open:             { type: 'integer', example: 10 },
          Closed:           { type: 'integer', example: 20 },
          'Work Completed': { type: 'integer', example: 8 },
          Cancelled:        { type: 'integer', example: 4 },
        },
      },
      SrsBreakdown: {
        type: 'object',
        properties: {
          allTime:   { type: 'array', items: { $ref: '#/components/schemas/SrsRow' } },
          last7Days: { type: 'array', items: { $ref: '#/components/schemas/SrsRow' } },
          today:     { type: 'array', items: { $ref: '#/components/schemas/SrsRow' } },
        },
      },
    },
  },

  paths: {

    // ── Auth ─────────────────────────────────────────────────────────────────
    '/api/v1/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new OWNER account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name:             { type: 'string', example: 'Ahmed Ali' },
                  email:            { type: 'string', format: 'email' },
                  password:         { type: 'string', minLength: 6 },
                  phone:            { type: 'string', example: '+966501234567' },
                  campany:          { type: 'string' },
                  industry:         { type: 'string' },
                  campanySize:      { type: 'string' },
                  campanyRole:      { type: 'string' },
                  chatVolume:       { type: 'string' },
                  website:          { type: 'string' },
                  acceptedTerms:    { type: 'boolean' },
                  acceptedAuthorize:{ type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Confirmation email sent' },
          400: { $ref: '#/components/schemas/~1ValidationError' },
        },
      },
    },
    '/api/v1/auth/confirm-register': {
      post: {
        tags: ['Auth'],
        summary: 'Confirm email and activate account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token'],
                properties: { token: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Account confirmed, returns JWT' },
          400: { description: 'Invalid or expired token' },
        },
      },
    },
    '/api/v1/auth/confirm-member': {
      post: {
        tags: ['Auth'],
        summary: 'Confirm member invitation — set password and activate account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token', 'password'],
                properties: {
                  token:    { type: 'string', description: 'JWT from invitation email' },
                  password: { type: 'string', minLength: 6 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Account confirmed, returns JWT and user summary' },
          400: { description: 'Invalid or expired token / already confirmed' },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login — returns JWT containing id, role, ownerId',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email:    { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'JWT token and user summary',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string' },
                    user: {
                      type: 'object',
                      properties: {
                        id:    { type: 'string' },
                        name:  { type: 'string' },
                        email: { type: 'string' },
                        role:  { type: 'string', enum: ['OWNER', 'GUARD', 'ADMIN', 'OPERATION'] },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: 'Invalid credentials or email not confirmed' },
        },
      },
    },
    '/api/v1/auth/trailer': {
      post: {
        tags: ['Auth'],
        summary: 'Submit a trial plan request (sends confirmation email)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'phone', 'password', 'plan'],
                properties: {
                  name:          { type: 'string' },
                  email:         { type: 'string', format: 'email' },
                  phone:         { type: 'string' },
                  password:      { type: 'string' },
                  plan:          { type: 'string', example: 'starter' },
                  campany:       { type: 'string' },
                  industry:      { type: 'string' },
                  city:          { type: 'string' },
                  country:       { type: 'string' },
                  campanySize:   { type: 'string' },
                  chatVolume:    { type: 'string' },
                  aiConnect:     { type: 'string' },
                  aiIntegration: { type: 'string' },
                  whatsapp:      { type: 'string' },
                  website:       { type: 'string' },
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

    // ── Check Email ───────────────────────────────────────────────────────────
    '/api/v1/check-email': {
      get: {
        tags: ['User'],
        summary: 'Check if an email is already registered',
        parameters: [
          { in: 'query', name: 'email', required: true, schema: { type: 'string', format: 'email' } },
        ],
        responses: {
          200: {
            description: 'Availability flag',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { available: { type: 'boolean', example: true } },
                },
              },
            },
          },
          400: { description: 'Missing email parameter' },
        },
      },
    },

    // ── User ─────────────────────────────────────────────────────────────────
    '/api/v1/user': {
      get: {
        tags: ['User'],
        summary: `List confirmed users with pagination. ${adminNote}`,
        security: bearerAuth,
        parameters: [
          { in: 'query', name: 'page',  schema: { type: 'integer', default: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 10, maximum: 100 } },
        ],
        responses: {
          200: { description: 'Paginated user list (password excluded)' },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden – ADMIN only' },
        },
      },
    },
    '/api/v1/user/search': {
      get: {
        tags: ['User'],
        summary: `Search users by name, email, or token. ${adminNote}`,
        security: bearerAuth,
        parameters: [
          { in: 'query', name: 'q', schema: { type: 'string' }, description: 'Search query (max 5 results)' },
        ],
        responses: {
          200: { description: 'Matching users (password excluded)' },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden – ADMIN only' },
        },
      },
    },
    '/api/v1/user/{id}': {
      get: {
        tags: ['User'],
        summary: `Get user by ID. ${adminNote}`,
        security: bearerAuth,
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'User object (password excluded)' },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden – ADMIN only' },
          404: { description: 'User not found' },
        },
      },
    },

    '/api/v1/member': {
      post: {
        tags: ['Member'],
        summary: `Create a member (e.g. GUARD) under the authenticated Owner. ${ownerNote}`,
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'role'],
                properties: {
                  name:  { type: 'string', example: 'Khalid Guard' },
                  email: { type: 'string', format: 'email' },
                  role:  { type: 'string', enum: ['GUARD'], example: 'GUARD' },
                  phone:       { type: 'string', example: '+966501234567' },
                  compoundIds: {
                    type: 'array',
                    items: { type: 'string', format: 'uuid' },
                    minItems: 1,
                    description: 'IDs of compounds (owned by the OWNER) to assign this guard to',
                    example: ['uuid-of-compound-1', 'uuid-of-compound-2'],
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Member created — invitation email sent, member must confirm to set password',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Member' },
                    {
                      type: 'object',
                      properties: {
                        assignedCompounds: {
                          type: 'array',
                          items: { type: 'string', format: 'uuid' },
                          description: 'IDs of compounds the guard was assigned to',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: ValidationError,
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden – OWNER only' },
          404: { description: 'One or more compoundIds not found or not owned by this OWNER' },
          409: { description: 'Email already registered' },
        },
      },
      get: {
        tags: ['Member'],
        summary: `List all members belonging to the authenticated Owner. ${ownerNote}`,
        security: bearerAuth,
        responses: {
          200: {
            description: 'Array of members (password excluded)',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Member' } },
              },
            },
          },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden – OWNER only' },
        },
      },
    },
    '/api/v1/member/{id}': {
      get: {
        tags: ['Member'],
        summary: `Get a member by ID (must belong to the Owner). ${ownerNote}`,
        security: bearerAuth,
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Member' } } }, description: 'Member' },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden – OWNER only' },
          404: { description: 'Member not found' },
        },
      },
      patch: {
        tags: ['Member'],
        summary: `Update a member. ${ownerNote}`,
        security: bearerAuth,
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name:        { type: 'string' },
                  phone:       { type: 'string' },
                  role:        { type: 'string', enum: ['GUARD', 'OPERATION'] },
                  compoundIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Updated member' },
          400: ValidationError,
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden – OWNER only' },
          404: { description: 'Member not found' },
        },
      },
      delete: {
        tags: ['Member'],
        summary: `Delete a member. ${ownerNote}`,
        security: bearerAuth,
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Member deleted' },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden – OWNER only' },
          404: { description: 'Member not found' },
        },
      },
    },

    // ── Compound ─────────────────────────────────────────────────────────────
    '/api/v1/compound/my': {
      get: {
        tags: ['Compound'],
        summary: `List all compounds owned by the authenticated OWNER, with unit and guard counts. ${ownerNote}`,
        security: bearerAuth,
        responses: {
          200: {
            description: 'Array of compounds belonging to the OWNER',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    allOf: [
                      { $ref: '#/components/schemas/Compound' },
                      {
                        type: 'object',
                        properties: {
                          _count: {
                            type: 'object',
                            properties: {
                              units:  { type: 'integer', example: 5 },
                              guards: { type: 'integer', example: 2 },
                            },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden – OWNER only' },
        },
      },
    },
    '/api/v1/compound': {
      post: {
        tags: ['Compound'],
        summary: `Create a compound. Slug auto-generated as COMP_{name}. ${adminNote}`,
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'ownerId'],
                properties: {
                  name:    { type: 'string', example: 'Green Valley' },
                  ownerId: { type: 'string', format: 'uuid', description: 'ID of the OWNER user' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Compound created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Compound' } } },
          },
          400: ValidationError,
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden – ADMIN only' },
        },
      },
      get: {
        tags: ['Compound'],
        summary: `List all compounds with owner info and counts. ${adminNote}`,
        security: bearerAuth,
        responses: {
          200: {
            description: 'Array of compounds',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Compound' } },
              },
            },
          },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden – ADMIN only' },
        },
      },
    },
    '/api/v1/compound/{id}': {
      get: {
        tags: ['Compound'],
        summary: `Get compound by ID with units and assigned guards. ${adminNote}`,
        security: bearerAuth,
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Compound detail',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CompoundDetail' } } },
          },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden – ADMIN only' },
          404: { description: 'Compound not found' },
        },
      },
      patch: {
        tags: ['Compound'],
        summary: `Update compound name or owner. Slug regenerated on name change. ${adminNote}`,
        security: bearerAuth,
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name:    { type: 'string' },
                  ownerId: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Updated compound' },
          400: ValidationError,
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden – ADMIN only' },
          404: { description: 'Compound not found' },
        },
      },
    },

    // ── Unit ─────────────────────────────────────────────────────────────────
    '/api/v1/unit': {
      post: {
        tags: ['Unit'],
        summary: `Create a unit inside a compound. Slug auto-generated as UNIT_{name}. ${adminNote}`,
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'compoundId'],
                properties: {
                  name:       { type: 'string', example: 'Tower A – 101' },
                  compoundId: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Unit created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Unit' } } },
          },
          400: ValidationError,
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden – ADMIN only' },
          404: { description: 'Compound not found' },
        },
      },
      get: {
        tags: ['Unit'],
        summary: `List all units for a compound. ${adminNote}`,
        security: bearerAuth,
        parameters: [
          { in: 'query', name: 'compoundId', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Parent compound ID' },
        ],
        responses: {
          200: {
            description: 'Array of units',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Unit' } },
              },
            },
          },
          400: { description: 'Missing compoundId' },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden – ADMIN only' },
          404: { description: 'Compound not found' },
        },
      },
    },
    '/api/v1/unit/{id}': {
      get: {
        tags: ['Unit'],
        summary: `Get unit by ID. ${adminNote}`,
        security: bearerAuth,
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Unit with parent compound',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Unit' } } },
          },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden – ADMIN only' },
          404: { description: 'Unit not found' },
        },
      },
      patch: {
        tags: ['Unit'],
        summary: `Update unit name. Slug regenerated automatically. ${adminNote}`,
        security: bearerAuth,
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { name: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Updated unit' },
          400: ValidationError,
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden – ADMIN only' },
          404: { description: 'Unit not found' },
        },
      },
    },

    // ── Visitors ─────────────────────────────────────────────────────────────
    '/api/v1/visitors': {
      post: {
        tags: ['Visitors'],
        summary: `Create a new visit record. ${authNote}`,
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: [
                  'residentFullName', 'residentUnit', 'residentPhone',
                  'visitorFullName', 'visitorCarType', 'visitorLicensePlate',
                  'visitDate', 'visitTime', 'compound', 'userToken',
                ],
                properties: {
                  residentFullName:    { type: 'string', example: 'Ahmed Salem' },
                  residentUnit:        { type: 'string', example: 'UNIT_tower_a_101', description: 'Must match an existing Unit slug' },
                  residentPhone:       { type: 'string', example: '+966501234567' },
                  visitorFullName:     { type: 'string', example: 'Mohammed Ali' },
                  visitorCarType:      { type: 'string', example: 'Toyota Camry' },
                  visitorLicensePlate: { type: 'string', example: 'ABC 1234' },
                  visitDate:           { type: 'string', format: 'date-time' },
                  visitTime:           { type: 'string', example: '14:30' },
                  compound:            { type: 'string', example: 'COMP_green_valley', description: 'Must match an existing Compound slug' },
                  userToken:           { type: 'string', example: 'TOK_abc123', description: 'User generated token (User.generatedToken)' },
                  pdfUrl:              { type: 'string', format: 'uri' },
                  qrCode:              { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Visit created with resolved compoundRef and residentUnitRef',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Visit' } } },
          },
          400: ValidationError,
          401: { description: 'Unauthorized' },
          404: { description: 'Unit or Compound slug not found' },
        },
      },
      get: {
        tags: ['Visitors'],
        summary: `List visits with pagination and optional unit filter. ${authNote}`,
        security: bearerAuth,
        parameters: [
          { in: 'query', name: 'page',  schema: { type: 'integer', default: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 10, maximum: 100 } },
          { in: 'query', name: 'unit',  schema: { type: 'string' }, description: 'Partial match on residentUnit' },
        ],
        responses: {
          200: {
            description: 'Paginated visits',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data:       { type: 'array', items: { $ref: '#/components/schemas/Visit' } },
                    pagination: { $ref: '#/components/schemas/Pagination' },
                  },
                },
              },
            },
          },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/v1/visitors/stats': {
      get: {
        tags: ['Visitors'],
        summary: `Visitor stats — total, per compound/unit, last 7 days, today. ${authNote}`,
        security: bearerAuth,
        responses: {
          200: { description: 'Statistics object' },
          401: { description: 'Unauthorized' },
        },
      },
    },

    // ── Subscription Request ──────────────────────────────────────────────────
    '/api/v1/subscription-request': {
      post: {
        tags: ['Subscription Request'],
        summary: 'Submit a new subscription request (public)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password', 'campanyRole', 'plan'],
                properties: {
                  name:              { type: 'string' },
                  email:             { type: 'string', format: 'email' },
                  password:          { type: 'string', minLength: 6 },
                  campanyRole:       { type: 'string' },
                  plan:              { type: 'string' },
                  campany:           { type: 'string' },
                  industry:          { type: 'string' },
                  city:              { type: 'string' },
                  country:           { type: 'string' },
                  totalBranches:     { type: 'string' },
                  chatVolume:        { type: 'string' },
                  aiIntegration:     { type: 'string' },
                  campanySize:       { type: 'string' },
                  website:           { type: 'string' },
                  phone:             { type: 'string' },
                  whatsapp:          { type: 'string' },
                  acceptedAuthorize: { type: 'boolean' },
                  acceptedTerms:     { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Request created (password excluded)',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SubscriptionRequest' } } },
          },
          400: ValidationError,
          409: { description: 'Email already submitted' },
        },
      },
      get: {
        tags: ['Subscription Request'],
        summary: `List all subscription requests with pagination. ${adminNote}`,
        security: bearerAuth,
        parameters: [
          { in: 'query', name: 'page',  schema: { type: 'integer', default: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 10, maximum: 100 } },
        ],
        responses: {
          200: {
            description: 'Paginated subscription requests',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data:       { type: 'array', items: { $ref: '#/components/schemas/SubscriptionRequest' } },
                    pagination: { $ref: '#/components/schemas/Pagination' },
                  },
                },
              },
            },
          },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden – ADMIN only' },
        },
      },
    },
    '/api/v1/subscription-request/{id}': {
      get: {
        tags: ['Subscription Request'],
        summary: `Get subscription request by ID. ${adminNote}`,
        security: bearerAuth,
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Subscription request (password excluded)',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SubscriptionRequest' } } },
          },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden – ADMIN only' },
          404: { description: 'Not found' },
        },
      },
    },

    // ── QR Code ───────────────────────────────────────────────────────────────
    '/api/v1/qr-code': {
      post: {
        tags: ['QR Code'],
        summary: 'Create a visit and generate a QR-code PDF',
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
                  residentFullName:    { type: 'string' },
                  residentUnit:        { type: 'string', example: 'UNIT_tower_a_101' },
                  residentPhone:       { type: 'string' },
                  visitorFullName:     { type: 'string' },
                  visitorCarType:      { type: 'string' },
                  visitorLicensePlate: { type: 'string' },
                  visitDate:           { type: 'string', format: 'date' },
                  visitTime:           { type: 'string', example: '14:30' },
                  compound:            { type: 'string', example: 'COMP_green_valley' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Visit created with pdfUrl and qrCode' },
          400: ValidationError,
        },
      },
    },
    '/api/v1/qr-code/{id}': {
      get: {
        tags: ['QR Code'],
        summary: 'Get visit details by ID',
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
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
          { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'PDF stream', content: { 'application/pdf': {} } },
          404: { description: 'PDF not found' },
        },
      },
    },

    // ── Analytics ─────────────────────────────────────────────────────────────
    '/api/v1/analytics/requests/by-agent': {
      get: {
        tags: ['Analytics'],
        summary: `SRS statistics grouped by category, compound, and unit (all-time / 7 days / today). ${ownerNote}`,
        security: bearerAuth,
        responses: {
          200: {
            description: 'Breakdown by category, compound, and unit — scoped to the OWNER\'s data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    byCategory: { $ref: '#/components/schemas/SrsBreakdown' },
                    byCompound: { $ref: '#/components/schemas/SrsBreakdown' },
                    byUnit:     { $ref: '#/components/schemas/SrsBreakdown' },
                  },
                },
              },
            },
          },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden – OWNER only' },
        },
      },
    },
    '/api/v1/analytics/requests/status': {
      get: {
        tags: ['Analytics'],
        summary: `SRS request counts grouped by status — scoped to the OWNER's data. ${ownerNote}`,
        security: bearerAuth,
        responses: {
          200: { description: 'Status breakdown' },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden – OWNER only' },
        },
      },
    },
    '/api/v1/analytics/requests/list': {
      get: {
        tags: ['Analytics'],
        summary: `Paginated SRS list with filters — scoped to the OWNER's data. ${ownerNote}`,
        security: bearerAuth,
        parameters: [
          { in: 'query', name: 'page',     schema: { type: 'integer', default: 1 } },
          { in: 'query', name: 'limit',    schema: { type: 'integer', default: 10, maximum: 100 } },
          { in: 'query', name: 'status',   schema: { type: 'string', enum: ['Open', 'Closed', 'Work Completed', 'Cancelled'] } },
          { in: 'query', name: 'category', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Paginated SRS list with category options' },
          400: { description: 'Invalid query parameters' },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden – OWNER only' },
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
                  name:    { type: 'string' },
                  email:   { type: 'string', format: 'email' },
                  phone:   { type: 'string' },
                  volume:  { type: 'string', example: '500+' },
                  website: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Message sent successfully' },
          400: ValidationError,
        },
      },
    },
  },
};
