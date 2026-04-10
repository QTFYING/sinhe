# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**经销商订单收款平台** (Dealer Order Collection Platform) — a SaaS monorepo built with **Turborepo + pnpm workspace**.

Currently contains:
- `apps/api`: NestJS backend API (core service)
- `packages/`: Shared types, utilities

## Development Setup

### Prerequisites
- Node.js >= 22.0.0
- pnpm >= 9.0.0
- Docker (for PostgreSQL + Redis) or local installations

### Quick Start

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Start databases (choose one):**
   - Docker: `docker-compose up -d` (recommended)
   - Local: PostgreSQL on :5432, Redis on :6379

3. **Initialize database schema:**
   ```bash
   pnpm --filter api prisma:push      # Create/update tables
   pnpm --filter api prisma:generate  # Generate Prisma client
   ```

4. **Seed test data:**
   ```bash
   pnpm db:seed
   ```
   Creates OS admin (`admin` / `123456`) and tenant owner (`boss` / `123456`).

5. **Start development servers:**
   ```bash
   pnpm run dev
   ```
   - API: `http://localhost:3000`
   - Swagger docs: `http://localhost:3000/api/docs`

## API Structure

### Core Modules (in `apps/api/src/`)
- **auth**: JWT authentication, passport-jwt strategy
- **tenant**: Multi-tenant management
- **order**: Order management core business logic
- **import**: Data import & pre-validation
- **payment**: Payment processing
- **print**: Print-related interfaces
- **report**: Reporting and analytics
- **notification**: Notification system
- **prisma**: Database client factory & lifecycle
- **redis**: Caching and session management

### Common Patterns (in `apps/api/src/common/`)
- **interceptors/response.interceptor.ts**: Global response wrapping
- **filters/business-exception.filter.ts**: Global exception handling
- **exceptions/**: Custom business exception classes

## Key Commands

```bash
# Development
pnpm run dev              # Start all services in watch mode
pnpm --filter api dev     # Start only API

# Building
pnpm run build            # Build all packages
pnpm --filter api build   # Build only API

# Database
pnpm --filter api prisma:push       # Migrate schema to database
pnpm --filter api prisma:generate   # Regenerate Prisma client
pnpm db:seed                         # Insert seed data

# Quality
pnpm run lint             # Run linting across all packages
pnpm run format           # Format code with Prettier

# Database scripts
pnpm db:init              # Initialize database for production
```

## Architecture Notes

### Database
- **ORM**: Prisma with PostgreSQL
- **Schema location**: `apps/api/prisma/schema.prisma`
- **Multi-tenant design**: Includes tenant isolation patterns (red-line security standards per README)
- **Seed data**: `scripts/db-seed.js`, `scripts/db-init.js`

### API Patterns
- **Framework**: NestJS 10.x with decorators-based dependency injection
- **Validation**: class-validator + class-transformer for DTO validation
- **Documentation**: Swagger auto-generated via decorators at `/api/docs`
- **Auth**: JWT via Passport.js, protected routes use `@UseGuards(JwtAuthGuard)`
- **CORS**: Localhost allowed by default in dev; configurable via `CORS_ORIGINS` env var
- **Global prefix**: All routes prefixed with `/api`

### Shared Packages
- `@shou/types`: Shared type definitions and enums
- `@shou/utils`: Shared utility functions

## Environment Variables

Located in `apps/api/.env`:
```
DATABASE_URL          # PostgreSQL connection string
REDIS_URL             # Redis connection string
JWT_SECRET            # Secret for signing JWT tokens
CORS_ORIGINS          # Comma-separated allowed origins (optional)
```

## Common Development Tasks

### Running a single module's tests
Currently no test setup visible in repo (Jest/Vitest not configured). Tests should be added to individual app/package `jest.config.js` if needed.

### Debugging the API
```bash
pnpm --filter api start:debug    # Start with debugger on port 9229
```

### Generating new Prisma schema
After modifying `schema.prisma`, always run:
```bash
pnpm --filter api prisma:generate
```

### Adding a new module
1. Create `src/[module-name]/` folder
2. Add `[module].module.ts` with `@Module()` decorator
3. Import the new module in `app.module.ts`
4. Add controllers/services/providers as needed

## Workspace Structure

```
.
├── apps/
│   └── api/                          # Main NestJS API
│       ├── src/
│       │   ├── auth/, order/, ...   # Feature modules
│       │   ├── common/               # Shared middleware, filters, interceptors
│       │   ├── prisma/               # Database setup
│       │   ├── main.ts               # Bootstrap
│       │   └── app.module.ts         # Root module
│       ├── prisma/
│       │   └── schema.prisma         # Database schema
│       └── .env                      # Environment variables
├── packages/
│   ├── types/                        # Shared type definitions
│   ├── utils/                        # Shared utilities
│   ├── shared-types/                 # Additional shared types
│   └── shared-utils/                 # Additional shared utilities
├── docs/                             # API documentation
├── scripts/                          # Database setup scripts
├── turbo.json                        # Turborepo configuration
├── pnpm-workspace.yaml               # Workspace packages definition
└── package.json                      # Root package.json with shared scripts
```

## Turborepo Tasks

Defined in `turbo.json`:
- **build**: Depends on dependencies being built first (`^build`)
- **dev**: No caching, persistent task (watch mode)
- **lint**: Depends on dependencies being built first
