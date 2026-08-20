# Secure Login System with User Details & File Access

This repository contains two distinct backend implementations for a secure authentication and file access system, sharing a single provided frontend client.

## 1. Authentication Architecture
*   **Custom Backend (JWT)**: I chose JSON Web Tokens (JWT) for the Node.js implementation. JWTs are stateless, meaning the server does not need to query the database to verify a user's session on every single request. This makes the REST API highly scalable and fast.
*   **Appwrite Backend (Sessions)**: I utilized Appwrite's default session-based authentication. It automatically issues secure, HTTP-only cookies. This provides excellent built-in protection against client-side script attacks (XSS) without requiring additional manual configuration.

## 2. Security Implementations
*   **Under-the-Hood Logout**:
    *   **Custom**: Implemented via a server-side token blacklist. When a user logs out, their specific token is added to an in-memory list on the server. The authentication middleware checks this blacklist and explicitly rejects invalidated tokens, ensuring true server-side session termination rather than just relying on the client to delete the token.
    *   **Appwrite**: Uses the `account.deleteSession('current')` SDK method, which actively targets and destroys the secure session record directly on the Appwrite cloud servers.
*   **Enforcing User Data Isolation**:
    *   **Custom**: Data isolation is enforced strictly at the database query level. When a user requests a file, the SQL query explicitly filters by `WHERE owner_id = req.user.id`. Even if a user attempts to manually request a file ID belonging to someone else, the controller verifies ownership before returning any data.
    *   **Appwrite**: Enforced using Appwrite's native Document Level Security (DLS). During the automated seeding process, read and write permissions were explicitly restricted to the file owner using `Role.user(userId)`. The database engine itself blocks unauthorized access, returning a 404 error to mask the file's existence from unauthorized users.

## 3. Appwrite Integration Details
*   **Handled Automatically by Appwrite**: Password cryptographic hashing (Argon2), secure cookie generation, active session state management, rate limiting, and brute-force protection at the network level.
*   **Configured Manually**: Project creation, defining the database and collection schema (columns/attributes), establishing strict Document Level Security (DLS) rules, and writing the custom JavaScript adapter (`appwrite-adapter.js`) to intercept the provided frontend client's network requests and translate them into Appwrite SDK commands.

## 4. Future Improvements
*   **Redis Cache Integration**: I would move the custom backend's token blacklist from local in-memory storage to a Redis database. This ensures the blacklist persists if the server restarts and allows the system to scale across multiple server instances.
*   **Refresh Token Rotation**: I would implement a short-lived access token (e.g., 15 minutes) and a long-lived, securely stored refresh token system. This maximizes security while maintaining a seamless user experience.
*   **Input Validation Pipeline**: I would integrate a schema validation library (like Zod or Joi) to strictly sanitize and validate all incoming API payloads before they reach the controller logic.

## 5. Setup Instructions
### Custom Backend (Node/Express + PostgreSQL)
1. Navigate to the `custom-backend` directory.
2. Run `npm install` to install all dependencies.
3. Create a `.env` file using the provided `.env.example` as a template and enter your local PostgreSQL credentials.
4. Create a new PostgreSQL database named `secure_auth`.
5. Run `node seed.js` to automatically populate the database with the 3 required test users and their files.
6. Run `npm start` to boot the server on port 3000.
7. Open `public/index.html` in your browser and select the "Custom REST backend" mode.

### Managed Backend (Appwrite)
1. Open `public/index.html` and select the "Appwrite" mode. 
2. The testing client will connect to the cloud database automatically via the custom adapter.
3. *(Optional)* To re-seed the cloud database, navigate to `appwrite-backend`, create a `.env` file with your Appwrite API credentials, run `npm install`, and execute `node seed.js`.