# StackMap Server API Reference

This document describes every HTTP endpoint exposed by the StackMap server, the controller or handler behind it, what each route expects, and what it returns.

## Overview

- **Framework:** Express
- **Default port:** `5000`
- **Base API prefixes:**
  - `/api/auth`
  - `/api/repos`
  - `/api/docs`
- **Health check:** `/health`
- **Authentication:** Bearer JWT for all protected routes

## How authentication works

1. The client starts the GitHub OAuth flow via `GET /api/auth/github`.
2. GitHub redirects back to `GET /api/auth/github/callback?code=...`.
3. The backend exchanges the GitHub code for an access token, upserts the user in the database, signs a JWT, and redirects the browser to:
   - `${FRONTEND_URL}/dashboard?token=<jwt>`
4. Protected routes require:

```http
Authorization: Bearer <jwt>
```

### Authentication failures

All routes using `authGuard` can return:

- `401 { "error": "Missing Authorization header" }` when the header is missing or not prefixed with `Bearer `
- `401 { "error": "User no longer exists" }` when the JWT is valid but the DB user no longer exists
- `401 { "error": "Unauthorized" }` when JWT verification or other auth middleware logic fails

## Core response shapes

These are the main persisted entities exposed by the API.

### User

```json
{
  "id": "string",
  "githubId": "string",
  "username": "string",
  "email": "string | null",
  "avatarUrl": "string | null",
  "createdAt": "ISO datetime"
}
```

### Repo

```json
{
  "id": "string",
  "userId": "string",
  "githubRepoId": "string",
  "name": "string",
  "fullName": "string",
  "description": "string | null",
  "language": "string | null",
  "isIndexed": true,
  "indexedAt": "ISO datetime | null",
  "createdAt": "ISO datetime"
}
```

### RepoFile

Actual fields returned vary by endpoint.

Stored model:

```json
{
  "id": "string",
  "repoId": "string",
  "path": "string",
  "name": "string",
  "extension": "string | null",
  "size": 123,
  "commitCount": 0,
  "content": "string | null",
  "summary": "string | null"
}
```

### Query

```json
{
  "id": "string",
  "userId": "string",
  "repoId": "string",
  "question": "string",
  "answer": "string",
  "filesReferenced": ["path/to/file.ts"],
  "createdAt": "ISO datetime"
}
```

## Endpoint catalog

---

## 1) Health and docs

### `GET /health`

- **Handler:** inline handler in `src/index.ts`
- **Auth required:** No
- **Request body:** None
- **Query params:** None
- **Path params:** None

**Success response**

- `200 OK`

```json
{
  "status": "StackMap API running",
  "timestamp": "2026-03-19T12:34:56.789Z"
}
```

**Notes**

- Useful for uptime checks and deployment validation.

### `GET /api/docs`

- **Handler:** Swagger UI middleware
- **Auth required:** No
- **Purpose:** Serves the interactive OpenAPI docs UI

**Response**

- `200 OK` with HTML/Swagger assets

**Notes**

- The generated Swagger document exists in `src/docs/swagger.ts`.
- Some Swagger entries are out of sync with the actual router definitions; use this file and the route/controller code as the source of truth.

---

## 2) Auth endpoints

### `GET /api/auth/github`

- **Controller:** `githubRedirect`
- **File:** `src/controllers/auth.controller.ts`
- **Auth required:** No

**What it receives**

- No request body
- No path params
- No query params expected from the client

**What it does**

- Builds a GitHub OAuth authorize URL using:
  - `client_id`
  - `redirect_uri = ${BACKEND_URL}/api/auth/github/callback`
  - `scope = repo read:user user:email`
  - `allow_signup = true`
- Redirects the user to GitHub.

**Success response**

- `302 Found` redirect to GitHub OAuth authorization page

**Common failure modes**

- App boot fails earlier if `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, or `JWT_SECRET` are missing.

---

### `GET /api/auth/github/callback`

- **Controller:** `githubCallback`
- **Auth required:** No

**What it receives**

- **Query parameters**
  - `code` (required, string): OAuth authorization code from GitHub

**Validation**

- Returns `400` if `code` is missing

**What it does**

- Exchanges `code` for a GitHub access token
- Fetches the authenticated GitHub profile
- Fetches emails if the primary profile email is absent
- Upserts the local `User`
- Signs a JWT with:
  - `userId`
  - `githubId`
  - expiration: `24h`
- Redirects to `${FRONTEND_URL}/dashboard?token=<jwt>`

**Success response**

- `302 Found` redirect to frontend dashboard with JWT in the query string

**Error responses**

- `400 Bad Request`

```json
{ "error": "Missing code from GitHub" }
```

- `400 Bad Request`

```json
{ "error": "Unable to retrieve access token from GitHub" }
```

- `500 Internal Server Error`

```json
{ "error": "Failed to complete GitHub OAuth flow" }
```

**Important response note**

- This endpoint does **not** return the token as JSON; it redirects with the token in the frontend URL.

---

### `GET /api/auth/me`

- **Controller:** `getCurrentUser`
- **Middleware:** `authGuard`
- **Auth required:** Yes

**What it receives**

- **Headers**
  - `Authorization: Bearer <jwt>`

**What it returns**

- `200 OK`

```json
{
  "user": {
    "id": "clx...",
    "githubId": "123456",
    "username": "octocat",
    "email": "octocat@example.com",
    "avatarUrl": "https://avatars.githubusercontent.com/u/...",
    "createdAt": "2026-03-19T12:34:56.789Z"
  }
}
```

**Error responses**

- `401 Unauthorized` from `authGuard`
- `404 Not Found`

```json
{ "error": "User not found" }
```

- `500 Internal Server Error`

```json
{ "error": "Failed to fetch user profile" }
```

---

## 3) Repository endpoints

All routes in this section require Bearer authentication.

### `GET /api/repos`

- **Controller:** `listRepos`
- **Middleware:** `authGuard`

**What it receives**

- **Headers**
  - `Authorization: Bearer <jwt>`

**What it does**

- Uses the user's stored GitHub access token to fetch GitHub repositories via `GET https://api.github.com/user/repos`
- Maps GitHub data to local repo records
- Upserts repository metadata into the local database
- Returns the final DB-backed repo list for the authenticated user

**Success response**

- `200 OK`

```json
{
  "repos": [
    {
      "id": "repo_cuid",
      "userId": "user_cuid",
      "githubRepoId": "123456789",
      "name": "Stackmap-Server",
      "fullName": "owner/Stackmap-Server",
      "description": "API server",
      "language": "TypeScript",
      "isIndexed": false,
      "indexedAt": null,
      "createdAt": "2026-03-19T12:34:56.789Z"
    }
  ]
}
```

**Error responses**

- `400 Bad Request`

```json
{ "error": "No GitHub access token found" }
```

- `401 Unauthorized` from `authGuard`
- `500 Internal Server Error`

```json
{ "error": "Failed to list GitHub repositories" }
```

**Notes**

- This route is both a sync operation and a list operation.
- It does not just return DB contents; it first refreshes against GitHub.

---

### `POST /api/repos/connect`

- **Controller:** `connectRepo`
- **Middleware:** `authGuard`

**What it receives**

- **Headers**
  - `Authorization: Bearer <jwt>`
- **JSON body**

```json
{
  "fullName": "owner/repository"
}
```

**Validation**

- `fullName` is required
- Expected format is effectively `owner/repo`; invalid values cause GitHub validation/service failure

**What it does**

- Checks whether the repo is already connected for the current user
- Verifies the GitHub repo exists and is accessible using the user's GitHub token
- Creates a local `Repo` record

**Success response**

- `201 Created`

```json
{
  "repo": {
    "id": "repo_cuid",
    "userId": "user_cuid",
    "githubRepoId": "123456789",
    "name": "repository",
    "fullName": "owner/repository",
    "description": "Example repo",
    "language": "TypeScript",
    "isIndexed": false,
    "indexedAt": null,
    "createdAt": "2026-03-19T12:34:56.789Z"
  }
}
```

**Error responses**

- `400 Bad Request`

```json
{ "error": "fullName is required" }
```

- `400 Bad Request`

```json
{ "error": "Repo already connected" }
```

- `401 Unauthorized` from `authGuard`
- `500 Internal Server Error`

```json
{ "error": "Failed to connect repository" }
```

**Notes**

- The actual route is `/api/repos/connect`.
- The Swagger file currently documents this incorrectly as `POST /api/repos`.

---

### `DELETE /api/repos/:repoId`

- **Controller:** `deleteRepo`
- **Middleware:** `authGuard`

**What it receives**

- **Headers**
  - `Authorization: Bearer <jwt>`
- **Path params**
  - `repoId` (required, string)

**What it does**

- Loads the repo by local DB ID
- Verifies the repo belongs to the authenticated user
- Deletes related `RepoFile` rows, related `Query` rows, and then the `Repo` row inside a Prisma transaction

**Success response**

- `200 OK`

```json
{ "success": true }
```

**Error responses**

- `400 Bad Request`

```json
{ "error": "Invalid repository ID" }
```

- `404 Not Found`

```json
{ "error": "Repository not found" }
```

- `401 Unauthorized` from `authGuard`
- `500 Internal Server Error`

```json
{ "error": "Failed to delete repository" }
```

---

## 4) Indexing and file endpoints

All routes in this section require Bearer authentication.

### `POST /api/repos/:repoId/index`

- **Route handler:** inline async handler in `src/routes/index-repo.ts`
- **Service used:** `indexRepository`
- **Middleware:** `authGuard`

**What it receives**

- **Headers**
  - `Authorization: Bearer <jwt>`
- **Path params**
  - `repoId` (required, string)
- **Body**
  - none

**What it does**

- Reads the authenticated user from `authGuard`
- Calls `indexRepository(repoId, user.accessToken)`
- Scans the repo tree from GitHub
- Skips paths matching ignore rules such as `node_modules`, `.git`, `dist`, `build`, and lockfiles
- Creates/updates/deletes local file records as needed
- Marks the repo as indexed and updates `indexedAt`

**Success response**

- `200 OK`

```json
{
  "success": true,
  "created": 14,
  "updated": 3,
  "deleted": 1,
  "total": 42
}
```

**Error responses**

- `401 Unauthorized` from `authGuard`
- `500 Internal Server Error`

```json
{ "error": "Failed to index repository" }
```


**Important note**

- The route handler does **not** verify repo ownership before calling the service.
- If `repoId` is invalid or missing in the DB, the service throws and the route returns a generic `500`, not a `404`.

---

### `GET /api/repos/:repoId/files`

- **Route handler:** inline async handler in `src/routes/index-repo.ts`
- **Middleware:** `authGuard`

**What it receives**

- **Headers**
  - `Authorization: Bearer <jwt>`
- **Path params**
  - `repoId` (required, string)

**What it does**

- Loads the repo by local ID
- Verifies ownership by comparing `repo.userId` to `req.user.id`
- Automatically re-indexes the repo if:
  - `indexedAt` is null, or
  - the last index is older than 10 minutes
- Returns all indexed files ordered by `path` ascending

**Success response**

- `200 OK`

```json
{
  "files": [
    {
      "id": "file_cuid",
      "repoId": "repo_cuid",
      "path": "src/index.ts",
      "name": "index.ts",
      "extension": "ts",
      "size": 824,
      "commitCount": 5,
      "content": "...possibly null...",
      "summary": null
    }
  ]
}
```

**Error responses**

- `401 Unauthorized` from `authGuard`
- `404 Not Found`

```json
{ "error": "Repo not found" }
```

- `500 Internal Server Error`

```json
{ "error": "Failed to list files" }
```

**Notes**

- Returned file objects are full `RepoFile` rows because the route uses `prisma.repoFile.findMany` without a `select` clause.
- There is an unused controller file with a different `listRepoFiles` shape, but the live router uses this inline route handler.

---

## 5) AI query and guide endpoints

All routes in this section require Bearer authentication.

### `POST /api/repos/:repoId/query`

- **Controller:** `queryRepository`
- **Middleware:** `authGuard`

**What it receives**

- **Headers**
  - `Authorization: Bearer <jwt>`
- **Path params**
  - `repoId` (required, string)
- **JSON body**

```json
{
  "question": "How does auth work in this repository?"
}
```

**Validation**

- Returns `400` if `question` is missing
- Returns `400` if `repoId` is not a string

**What it does**

- Confirms the repo exists and belongs to the authenticated user
- Loads repo files with `{ path, summary }`
- Sends the question plus file-summary context to Anthropic via `queryRepo`
- Parses file references mentioned in backticks from the AI answer
- Persists the query and answer in the `Query` table

**Success response**

- `200 OK`

```json
{
  "answer": "Authentication is enforced by `src/middleware/auth.ts` ...",
  "filesReferenced": [
    "src/middleware/auth.ts",
    "src/controllers/auth.controller.ts"
  ],
  "queryId": "query_cuid"
}
```

**Error responses**

- `400 Bad Request`

```json
{ "error": "question is required" }
```

- `400 Bad Request`

```json
{ "error": "Invalid repository ID" }
```

- `401 Unauthorized` from `authGuard`
- `404 Not Found`

```json
{ "error": "Repository not found" }
```

- `500 Internal Server Error`

```json
{ "error": "Failed to run query" }
```

---

### `GET /api/repos/:repoId/queries`

- **Controller:** `listQueries`
- **Middleware:** `authGuard`

**What it receives**

- **Headers**
  - `Authorization: Bearer <jwt>`
- **Path params**
  - `repoId` (required, string)

**What it does**

- Confirms the repo exists and belongs to the authenticated user
- Returns saved query history for the repo, ordered newest first

**Success response**

- `200 OK`

```json
{
  "queries": [
    {
      "id": "query_cuid",
      "userId": "user_cuid",
      "repoId": "repo_cuid",
      "question": "How does auth work?",
      "answer": "...",
      "filesReferenced": ["src/middleware/auth.ts"],
      "createdAt": "2026-03-19T12:34:56.789Z"
    }
  ]
}
```

**Error responses**

- `400 Bad Request`

```json
{ "error": "Invalid repository ID" }
```

- `401 Unauthorized` from `authGuard`
- `404 Not Found`

```json
{ "error": "Repository not found" }
```

- `500 Internal Server Error`

```json
{ "error": "Failed to list queries" }
```

---

### `POST /api/repos/:repoId/guide`

- **Controller:** `generateGuide`
- **Middleware:** `authGuard`

**What it receives**

- **Headers**
  - `Authorization: Bearer <jwt>`
- **Path params**
  - `repoId` (required, string)
- **Body**
  - none

**What it does**

- Confirms the repo exists and belongs to the authenticated user
- Loads file summaries for the repo
- Calls the Anthropic-backed `generateGuide` service
- Returns a generated Markdown onboarding guide as a string

**Success response**

- `200 OK`

```json
{
  "guide": "# Project Overview\n\n...generated markdown..."
}
```

**Error responses**

- `400 Bad Request`

```json
{ "error": "Invalid repository ID" }
```

- `401 Unauthorized` from `authGuard`
- `404 Not Found`

```json
{ "error": "Repository not found" }
```

- `500 Internal Server Error`

```json
{ "error": "Failed to generate guide" }
```

---

## Controller and handler map

| Route | Method | Controller / Handler | Protected | Notes |
|---|---|---|---|---|
| `/health` | GET | Inline handler in `src/index.ts` | No | Basic health response |
| `/api/docs` | GET | Swagger UI middleware | No | Serves interactive docs |
| `/api/auth/github` | GET | `githubRedirect` | No | Starts GitHub OAuth |
| `/api/auth/github/callback` | GET | `githubCallback` | No | Finishes OAuth and redirects to frontend |
| `/api/auth/me` | GET | `getCurrentUser` | Yes | Returns current user profile |
| `/api/repos` | GET | `listRepos` | Yes | Syncs repos from GitHub and returns DB records |
| `/api/repos/connect` | POST | `connectRepo` | Yes | Connects a repo by `fullName` |
| `/api/repos/:repoId` | DELETE | `deleteRepo` | Yes | Deletes repo + related records |
| `/api/repos/:repoId/index` | POST | Inline handler in `src/routes/index-repo.ts` | Yes | Triggers indexing |
| `/api/repos/:repoId/files` | GET | Inline handler in `src/routes/index-repo.ts` | Yes | Auto re-indexes when stale |
| `/api/repos/:repoId/query` | POST | `queryRepository` | Yes | Sends repo question to Anthropic |
| `/api/repos/:repoId/queries` | GET | `listQueries` | Yes | Returns query history |
| `/api/repos/:repoId/guide` | POST | `generateGuide` | Yes | Returns AI-generated markdown guide |

## Known implementation details and caveats

- `src/controllers/index.controller.ts` defines `indexRepo` and `listRepoFiles`, but those controllers are not currently wired into the active Express routes.
- The live `/api/repos/:repoId/files` route returns full `RepoFile` DB rows, not the reduced shape shown in the unused controller.
- The live `/api/repos/:repoId/index` route returns `{ success, created, updated, deleted, total }`, while Swagger documents a different shape.
- The live repo connect route is `POST /api/repos/connect`, while Swagger documents repo creation under `POST /api/repos`.
- File summaries are currently often `null` because the `summarizeFile(...)` call in the indexer is commented out.
- The AI query and guide endpoints rely on Anthropic and on repo file summary/context already being available in the database.

## Source-of-truth files used for this document

- `src/index.ts`
- `src/routes/auth.ts`
- `src/routes/repos.ts`
- `src/routes/index-repo.ts`
- `src/routes/query.ts`
- `src/controllers/auth.controller.ts`
- `src/controllers/repos.controller.ts`
- `src/controllers/query.controller.ts`
- `src/middleware/auth.ts`
- `src/services/indexer.service.ts`
- `src/services/github.service.ts`
- `src/services/ai.service.ts`
- `prisma/schema.prisma`
- `src/docs/swagger.ts`
