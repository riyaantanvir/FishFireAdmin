# FishFire Management System

## Overview

FishFire Management System is a full-stack web application designed for restaurant or food service management. It provides a comprehensive dashboard for managing daily orders, inventory items, and business operations. The system features a modern React frontend with a clean, professional UI built using shadcn/ui components, backed by a Node.js/Express server with PostgreSQL database integration.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The client-side application is built with React using TypeScript and follows a modern component-based architecture:

- **Framework**: React with TypeScript for type safety and developer experience
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state management and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming support
- **Forms**: React Hook Form with Zod validation for robust form handling
- **Build Tool**: Vite for fast development and optimized production builds

The frontend implements a dashboard layout with a collapsible sidebar navigation, protected routes requiring authentication, and dedicated pages for dashboard overview, daily orders management, and item management.

### Backend Architecture
The server-side follows a RESTful API architecture with Express.js:

- **Framework**: Express.js with TypeScript for the web server
- **Authentication**: Passport.js with local strategy for user authentication
- **Session Management**: Express sessions with PostgreSQL session store
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Validation**: Zod schemas shared between frontend and backend
- **Storage Abstraction**: Interface-based storage layer supporting both memory and database implementations

The backend provides REST endpoints for user authentication, order management, and item management, with all routes protected by authentication middleware.

### Data Storage
The application uses PostgreSQL as the primary database with Drizzle ORM:

- **Database**: PostgreSQL via Neon serverless database
- **ORM**: Drizzle ORM with PostgreSQL dialect for type-safe queries
- **Schema**: Shared TypeScript schema definitions between client and server
- **Migrations**: Drizzle Kit for database migrations and schema management
- **Session Store**: PostgreSQL-based session storage using connect-pg-simple

The database schema includes tables for users, orders, and items with proper relationships and constraints.

### Authentication & Authorization
Session-based authentication system with secure password handling:

- **Strategy**: Local authentication strategy with username/password
- **Password Security**: Scrypt-based password hashing with salt
- **Session Management**: Server-side sessions stored in PostgreSQL
- **Route Protection**: Middleware-based route protection for API endpoints
- **Frontend Guards**: Protected route components preventing unauthorized access

### Development Environment
The application is configured for modern development workflows:

- **Development Server**: Vite dev server with HMR for frontend, tsx for backend development
- **Type Checking**: TypeScript with strict configuration across the entire codebase
- **Path Aliases**: Configured import aliases for clean imports (@/ for client, @shared for shared code)
- **Build Process**: Separate build processes for frontend (Vite) and backend (esbuild)
- **Environment Variables**: Environment-based configuration for database connections and secrets

## External Dependencies

### Core Runtime Dependencies
- **@neondatabase/serverless**: Serverless PostgreSQL database connectivity
- **drizzle-orm**: Type-safe ORM for database operations
- **drizzle-zod**: Integration between Drizzle schemas and Zod validation
- **express**: Web application framework for Node.js
- **passport**: Authentication middleware with local strategy support
- **express-session**: Session middleware with PostgreSQL store via connect-pg-simple

### Frontend Libraries
- **React Ecosystem**: React, React DOM, React Hook Form for component architecture and form management
- **@tanstack/react-query**: Server state management and caching solution
- **wouter**: Lightweight routing library for single-page applications
- **@radix-ui/***: Comprehensive collection of accessible UI primitives
- **tailwindcss**: Utility-first CSS framework for styling
- **lucide-react**: Icon library providing consistent iconography

### Development & Build Tools
- **Vite**: Build tool and development server with React plugin support
- **TypeScript**: Type system for JavaScript with strict configuration
- **@hookform/resolvers**: Integration between React Hook Form and validation libraries
- **zod**: Schema validation library for runtime type checking
- **esbuild**: Fast JavaScript bundler for backend build process

### UI & Styling
- **shadcn/ui**: Component library built on Radix UI with Tailwind CSS styling
- **class-variance-authority**: Utility for creating variant-based component APIs
- **clsx**: Utility for constructing conditional className strings
- **tailwind-merge**: Utility for merging Tailwind CSS classes without conflicts

### Utility Libraries
- **date-fns**: Date manipulation library for handling timestamps
- **nanoid**: URL-safe unique string ID generator
- **cmdk**: Command palette component for enhanced user interactions