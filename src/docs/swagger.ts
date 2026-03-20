const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT ?? 5000}`;

const swaggerSpec = {
  openapi: "3.0.3",
  info: {
    title: "StackMap API",
    version: "1.0.0",
    description:
      "AI-powered codebase onboarding intelligence. Authenticate with GitHub, connect repos, index files, and ask Claude questions about your code.",
  },
  servers: [{ url: backendUrl, description: "Local/Deployed backend" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string" },
          details: { type: "string" },
        },
      },
      Repo: {
        type: "object",
        properties: {
          id: { type: "string" },
          fullName: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          isIndexed: { type: "boolean" },
        },
      },
      QueryResponse: {
        type: "object",
        properties: {
          answer: { type: "string" },
          filesReferenced: { type: "array", items: { type: "string" } },
          queryId: { type: "string" },
        },
      },
      DeletionResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string" },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/api/auth/github": {
      get: {
        tags: ["Auth"],
        summary: "Redirect to GitHub OAuth",
        responses: {
          302: { description: "Redirect to GitHub auth page" },
        },
      },
    },
    "/api/auth/github/callback": {
      get: {
        tags: ["Auth"],
        summary: "Handle GitHub OAuth callback",
        parameters: [
          {
            name: "code",
            in: "query",
            schema: { type: "string" },
            required: true,
          },
        ],
        responses: {
          302: { description: "Redirect to frontend with token" },
          400: { $ref: "#/components/schemas/ErrorResponse" },
          500: { $ref: "#/components/schemas/ErrorResponse" },
        },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get authenticated user profile",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Current user",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        githubId: { type: "string" },
                        username: { type: "string" },
                        email: { type: "string" },
                        avatarUrl: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/schemas/ErrorResponse" },
        },
      },
      delete: {
        tags: ["Auth"],
        summary: "Delete the authenticated user and all their data",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Account deleted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DeletionResponse" },
              },
            },
          },
          401: { $ref: "#/components/schemas/ErrorResponse" },
          500: { $ref: "#/components/schemas/ErrorResponse" },
        },
      },
    },
    "/api/repos": {
      get: {
        tags: ["Repositories"],
        summary: "List connected repositories",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "List of repos",
          },
        },
      },
      post: {
        tags: ["Repositories"],
        summary: "Connect a new repository",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { fullName: { type: "string" } },
                required: ["fullName"],
              },
            },
          },
        },
        responses: {
          201: { description: "Repo saved" },
          400: { $ref: "#/components/schemas/ErrorResponse" },
        },
      },
    },
    "/api/repos/{repoId}": {
      delete: {
        tags: ["Repositories"],
        summary: "Delete a connected repository",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "repoId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Deleted" },
          404: { $ref: "#/components/schemas/ErrorResponse" },
        },
      },
    },
    "/api/repos/{repoId}/index": {
      post: {
        tags: ["Indexing"],
        summary: "Index repository files",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "repoId",
            in: "path",
            schema: { type: "string" },
            required: true,
          },
        ],
        responses: {
          200: {
            description: "Index result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    filesIndexed: { type: "number" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/repos/{repoId}/files": {
      get: {
        tags: ["Indexing"],
        summary: "List indexed files",
        parameters: [
          {
            name: "repoId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Indexed files",
          },
        },
      },
    },
    "/api/repos/{repoId}/files/content": {
      get: {
        tags: ["Indexing"],
        summary: "Retrieve the latest text for a single file",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "repoId",
            in: "path",
            schema: { type: "string" },
            required: true,
          },
          {
            name: "path",
            in: "query",
            schema: { type: "string" },
            required: true,
            description: "Path inside the repository to fetch",
          },
        ],
        responses: {
          200: {
            description: "File contents",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    path: { type: "string" },
                    name: { type: "string" },
                    extension: { type: "string", nullable: true },
                    size: { type: "integer" },
                    summary: { type: "string", nullable: true },
                    content: { type: "string" },
                  },
                },
              },
            },
          },
          400: { $ref: "#/components/schemas/ErrorResponse" },
          404: { $ref: "#/components/schemas/ErrorResponse" },
          500: { $ref: "#/components/schemas/ErrorResponse" },
        },
      },
    },
    "/api/repos/{repoId}/query": {
      post: {
        tags: ["AI"],
        summary: "Ask Claude about the repo",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "repoId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { question: { type: "string" } },
                required: ["question"],
              },
            },
          },
        },
        responses: {
          200: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/QueryResponse" },
              },
            },
          },
        },
      },
    },
    "/api/repos/{repoId}/queries": {
      get: {
        tags: ["AI"],
        summary: "List previous queries",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "repoId",
            in: "path",
            schema: { type: "string" },
            required: true,
          },
        ],
        responses: {
          200: {
            description: "Stored queries",
          },
        },
      },
    },
    "/api/repos/{repoId}/guide": {
      post: {
        tags: ["AI"],
        summary: "Generate onboarding guide",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "repoId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "Markdown guide",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { guide: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },
  },
};

export default swaggerSpec;
