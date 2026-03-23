# StackMap Server

An AI-powered code repository analysis and documentation platform that helps developers understand, navigate, and onboard to codebases quickly using Claude AI.

## 🚀 Features

- **Repository Indexing**: Automatically index GitHub repositories and extract file structure
- **AI-Powered Code Analysis**: Use Claude AI to analyze code files and generate summaries
- **Intelligent Q&A**: Ask questions about your codebase and get context-aware answers
- **Onboarding Guides**: Generate structured onboarding guides for new developers
- **File Management**: Track file changes, commit history, and code evolution
- **GitHub Integration**: Seamless integration with GitHub repositories
- **RESTful API**: Comprehensive API for programmatic access

## 🏗️ Architecture

StackMap Server is built with a modern tech stack:

- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL with Prisma ORM
- **AI Integration**: Claude AI (Anthropic) for code analysis
- **Authentication**: JWT-based authentication with GitHub OAuth
- **API Documentation**: Swagger/OpenAPI integration
- **File Storage**: Supabase for file content storage

## 📋 Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database
- GitHub account with repository access
- Claude AI API key
- Supabase project

## 🔧 Installation

### 1. Clone the repository

```bash
git clone https://github.com/jackson951/Stackmap-Server.git
cd stackmap-server
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment Setup

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/stackmap?schema=public"

# Server
PORT=5000
FRONTEND_URL="https://stackmap-8ipx.vercel.app"

# Authentication
JWT_SECRET="your-super-secret-jwt-key"

# GitHub Integration
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# AI Services
ANTHROPIC_API_KEY="your-claude-api-key"

# Supabase
SUPABASE_URL="your-supabase-url"
SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_KEY="your-supabase-service-key"
```

### 4. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Or create and run migrations
npm run db:migrate
```

### 5. Start the server

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

## 📚 API Documentation

The API is documented using Swagger/OpenAPI and can be accessed at:

```
http://localhost:5000/api/docs
```

### Authentication

All API endpoints (except health check) require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Key Endpoints

#### Authentication
- `POST /api/auth/login` - GitHub OAuth login
- `POST /api/auth/logout` - Logout and invalidate token

#### Repositories
- `GET /api/repos` - List user repositories
- `POST /api/repos` - Add a new repository
- `DELETE /api/repos/:repoId` - Remove a repository

#### Repository Indexing
- `POST /api/repos/:repoId/index` - Index repository files
- `GET /api/repos/:repoId/files` - List indexed files

#### Code Analysis
- `POST /api/repos/:repoId/query` - Ask questions about the codebase
- `GET /api/repos/:repoId/queries` - List previous queries
- `GET /api/repos/:repoId/guide` - Generate onboarding guide

## 🎯 Usage Examples

### 1. Authenticate with GitHub

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"code": "github-auth-code"}'
```

### 2. Add a Repository

```bash
curl -X POST http://localhost:5000/api/repos \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"fullName": "owner/repository-name"}'
```

### 3. Index Repository

```bash
curl -X POST http://localhost:5000/api/repos/repo-id/index \
  -H "Authorization: Bearer your-jwt-token"
```

### 4. Query Codebase

```bash
curl -X POST http://localhost:5000/api/repos/repo-id/query \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"question": "How does the authentication system work?"}'
```

### 5. Generate Onboarding Guide

```bash
curl -X GET http://localhost:5000/api/repos/repo-id/guide \
  -H "Authorization: Bearer your-jwt-token"
```

## 🗃️ Database Schema

The application uses the following main entities:

### User
- GitHub authentication and user management
- Stores GitHub ID, username, email, and access tokens

### Repository
- Repository metadata and indexing status
- Links to user and associated files

### Repository File
- Individual file information within repositories
- Includes file paths, summaries, commit counts, and content

### Query
- Stores user questions and AI-generated answers
- Tracks referenced files for each query

## 🤖 AI Features

### Code Summarization
- Automatically generates concise summaries for important files
- Focuses on key files like README, package.json, and main entry points
- Uses Claude AI for intelligent analysis

### Intelligent Q&A
- Context-aware answers based on repository structure
- Cites specific files when providing answers
- Maintains conversation history for better context

### Onboarding Guides
- Structured Markdown guides for new developers
- Includes project overview, key files, architecture summary
- Provides starting points and known patterns

## 🔒 Security

- JWT-based authentication with secure token generation
- GitHub OAuth for secure user authentication
- Input validation and sanitization
- Rate limiting on API endpoints
- Secure environment variable management

## 🚀 Deployment

### Docker

```bash
# Build the image
docker build -t stackmap-server .

# Run with environment variables
docker run -p 5000:5000 \
  -e DATABASE_URL="your-database-url" \
  -e JWT_SECRET="your-secret" \
  stackmap-server
```

### Heroku

1. Create a new Heroku app
2. Add PostgreSQL addon
3. Set environment variables
4. Deploy from GitHub

### Vercel

1. Connect to GitHub repository
2. Set environment variables in project settings
3. Configure build command: `npm run build`
4. Set output directory: `dist`

## 🧪 Testing

```bash
# Run tests (if available)
npm test

# Run linting
npm run lint

# Check TypeScript
npm run typecheck
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Claude AI](https://anthropic.com) for the powerful AI capabilities
- [GitHub](https://github.com) for the excellent API
- [Prisma](https://prisma.io) for the fantastic ORM
- [Express.js](https://expressjs.com) for the robust web framework

## 📞 Support

For support, email support@stackmap.com or join our Slack channel.

## 🔗 Related Projects

- [StackMap Frontend](https://github.com/jackson951/stackmap-frontend) - The companion frontend application
- [StackMap CLI](https://github.com/jackson951/stackmap-cli) - Command-line interface for StackMap

---

**Built with ❤️ by the StackMap Team**