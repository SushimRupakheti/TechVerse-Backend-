# Recell Bazar API

## Login and signup injection protection

The API uses MongoDB through Mongoose, so the main risk for the auth flow is NoSQL query injection rather than classic SQL injection.

We hardened login and signup in these files:

- `src/dtos/auth.dto.ts`
  - `createUserDto` and `LoginUserDto` now require strict Zod objects.
  - Email values must be real email strings, are trimmed, and are normalized to lowercase.
  - Password values must be strings with at least 6 characters.
  - Extra request body keys are rejected, so payloads cannot smuggle unexpected query fields into the auth flow.

- `src/repositories/auth.repository.ts`
  - `getUserByEmail` rejects non-string email values at runtime.
  - The Mongoose lookup uses `{ email: { $eq: normalizedEmail } }`, which treats the email as an exact scalar value and prevents Mongo operators such as `$ne` or `$gt` from changing the query meaning.

The login and signup routes still pass through `src/routes/auth.route.ts`, which calls `AuthController.registerUser` and `AuthController.loginUser`. Those controller methods validate request bodies with the hardened DTOs before calling the auth service and repository.
