# AGENT.md - MySQL Backup System

## Environment
- Deno-based application (not Node.js)

## Build/Run Commands
- Local development: `deno run --allow-net --allow-env --allow-read --allow-write app.js`
- Docker build: `docker build -t mysql-backup .`
- Docker run: See README.md for full command with environment variables

## Code Style Guidelines
- Language: JavaScript with Deno
- Imports: Use Deno URL imports (https://deno.land/x/...)
- Error handling: Try/catch blocks with detailed error logging
- Logging: Use logInfo() and logError() functions
- Naming convention: camelCase for variables and functions
- Database access: Use KV store for app data, MySQL for backup operations
- API endpoints: RESTful with JSON responses
- Authentication: Cookie-based sessions with SHA-256 password hashing

## Project Structure
- Single app.js file contains the entire application
- Static files in /static directory
- Dockerfile and shell scripts for containerized deployment

## Important Modules
- Hono: Web framework
- mysql2: MySQL client
- nanoid: ID generation
- Deno.openKv: Key-value storage