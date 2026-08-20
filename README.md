# Secure Login System with User Details & File Access

This repository contains two distinct backend implementations for a secure authentication and file access system, sharing a single provided frontend client.

## Implementations

1. **Custom Backend**: Node.js, Express, and PostgreSQL.
2. **Managed Backend**: Appwrite Cloud via a custom client-side adapter.

## Setup Instructions

### Custom Backend (Node/Express)
1. Navigate to the `custom-backend` directory.
2. Run `npm install` to install dependencies.
3. Create a `.env` file based on the provided `.env.example` and update the PostgreSQL credentials.
4. Create a PostgreSQL database named `secure_auth`.
5. Run `node seed.js` to populate the database with test users.
6. Run `npm start` (or `npx nodemon server.js`) to start the server on port 3000.
7. Open `public/index.html` and select the "Custom REST backend" mode.

### Managed Backend (Appwrite)
1. The Appwrite backend is accessible via the "Appwrite" mode in `public/index.html`.
2. The project uses a custom adapter (`appwrite-adapter.js`) to translate REST calls to Appwrite Web SDK commands.
3. The database is pre-seeded. To re-seed, navigate to `appwrite-backend`, create a `.env` file with your Appwrite API credentials, run `npm install`, and execute `node seed.js`.

## Architectural Decisions & Security

### Authentication: JWT vs. Session-Based
* **Custom Backend (JWT)**: I selected JSON Web Tokens for the custom implementation. JWTs provide a stateless authentication mechanism, reducing database lookups for session validation on every protected route. This approach is highly scalable for REST APIs.
* **Appwrite Backend (Sessions)**: Appwrite handles authentication using secure, HTTP-only session cookies by default. This provides robust protection against Cross-Site Scripting (XSS) attacks out of the box.

### Logout Implementation
* **Custom Backend**: Implemented via a server-side token blacklist. When a user logs out, the specific JWT is added to an in-memory `Set`. The authentication middleware rejects any blacklisted tokens, strictly enforcing server-side invalidation.
* **Appwrite Backend**: Implemented using the `account.deleteSession('current')` SDK method, which actively destroys the session on the Appwrite cloud servers.

### User Data Isolation Enforcement
* **Custom Backend**: Data isolation is manually enforced at the controller level. For file access, the database queries strictly filter by `owner_id = req.user.id`. If a user requests a specific file ID, the controller explicitly verifies that the file's `owner_id` matches the authenticated user's ID before returning the data.
* **Appwrite Backend**: Enforced utilizing Appwrite's Document Level Security (DLS). During the seeding process, read and write permissions are explicitly granted only to the specific user's ID (`Role.user(userId)`). The Appwrite database engine automatically rejects unauthorized read attempts.

### Appwrite: Automatic vs. Manual Configuration
* **Handled Automatically**: Password hashing (Argon2), secure cookie generation, session management, rate limiting, and brute-force protection.
* **Configured Manually**: Database schema creation, collection attributes definition, Document Level Security enforcement rules, and the custom JavaScript adapter pattern to interface with the provided static HTML client.

### Future Improvements
Given more time, I would implement the following enhancements:
* **Redis Integration**: Transition the JWT token blacklist from in-memory storage to a Redis cache to ensure the blacklist persists across server restarts and scales across multiple server instances.
* **Refresh Tokens**: Implement a short-lived access token and long-lived refresh token architecture to enhance security while maintaining user experience.
* **Input Validation**: Add a robust validation library (like Zod or Joi) to strictly sanitize and validate all incoming request payloads.