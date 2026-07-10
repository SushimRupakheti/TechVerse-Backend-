# tech verse API

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

## Public signup role protection

Public signup must not accept a client-supplied `role` value. We fixed that in these files:

- `src/dtos/auth.dto.ts`: added `PublicRegisterUserDto` for `/auth/register`; it omits `role` and uses `.strict()`, so requests containing `role: "admin"` are rejected instead of trusted.
- `src/controllers/auth.controller.ts`: public registration rejects any request body containing `role`, then validates with `PublicRegisterUserDto` instead of the admin-capable `createUserDto`.
- `src/services/auth.services.ts`: `registerUser` always writes `role: "customer"` and `authProvider: "local"` when creating a public signup user, even if a caller bypasses the controller validation.
- `src/controllers/admin/user.contoller.ts`: admin-only user creation uses `AdminUserService.createUser`, so admin routes can still intentionally create privileged users while public signup cannot.

Example rejected public signup request:

```json
{
  "firstName": "bishal",
  "lastName": "tamang",
  "email": "try123@g.com",
  "contactNo": "9987654321",
  "address": "ktm",
  "password": "password",
  "role": "admin"
}
```

Expected response from `POST /api/auth/register`:

```json
{
  "success": false,
  "message": "Role cannot be set during public signup."
}
```

Status code: `400 Bad Request`.

If this endpoint still returns `200 OK` after this code change, restart the backend server. A running `ts-node` or `nodemon` process may still have the older controller loaded in memory.

## Profile update role protection

We also protected the profile update path so role escalation cannot be done after signup:

- `src/routes/auth.route.ts`: `/auth/update/:id` now requires `authorizedMiddleWare`.
- `src/controllers/auth.controller.ts`: `updateUser` only allows the same user or an admin to update the profile, validates the body with `UpdateProfileDto`, and rejects fields outside the allowed profile fields. A client cannot send `role: "admin"` through this endpoint.

## Secure image upload implementation

Image uploads follow OWASP File Upload Cheat Sheet guidance and are implemented in these files:

- `src/middlewares/secure-image-upload.middleware.ts`
  - Uses Multer `memoryStorage()` so files are validated before anything is written to disk.
  - Allows only `image/jpeg`, `image/png`, and `image/webp` MIME types.
  - Verifies actual file signatures and image structure with magic-byte parsers for JPEG, PNG, and WebP. File extensions are never trusted as proof of type.
  - Rejects dangerous and executable extensions such as `.php`, `.exe`, `.js`, `.html`, `.svg`, `.bat`, `.sh`, `.jar`, and similar.
  - Rejects double-extension names such as `image.jpg.php`.
  - Limits each image to `5 MB` and each request to max `5` images.
  - Rejects empty, malformed, or corrupted files.
  - Generates stored filenames with `crypto.randomUUID()` and a server-selected extension. Original filenames are never reused.
  - Strips common metadata where possible: JPEG APP/COM metadata, PNG ancillary metadata, and WebP EXIF/XMP/ICCP chunks.
  - Stores images in `private-uploads/images`, outside the public web root.
  - Logs upload failures with generic audit details while returning generic client errors.

- `src/routes/item.route.ts`
  - `POST /api/items/upload-photo` accepts one authenticated image in field `itemPhoto`.
  - `POST /api/items/upload-images` accepts up to five authenticated images in field `images`.
  - Both routes apply `authorizedMiddleWare`, `uploadRateLimiter`, strict Multer validation, magic-byte validation, and secure storage.

- `src/routes/upload.route.ts`
  - Stored files are not exposed with `express.static`.
  - Images are served through authenticated `GET /api/uploads/images/:fileName` with safe UUID filename validation and `X-Content-Type-Options: nosniff`.

- `src/app.ts`
  - Removed public `app.use("/uploads", express.static(...))` exposure.
  - Mounted secure authenticated image access at `/api/uploads`.

- `src/middlewares/rate-limit.middleware.ts`
  - Added `uploadRateLimiter` to reduce upload abuse and denial-of-service attempts.

### Example Next.js upload request

```tsx
"use client";

import { useState } from "react";

export default function ImageUploadExample({ token }: { token: string }) {
  const [files, setFiles] = useState<FileList | null>(null);

  async function uploadImages() {
    if (!files || files.length === 0) return;

    const formData = new FormData();
    Array.from(files).slice(0, 5).forEach((file) => {
      // Client-side checks improve UX only. Server-side validation is still required.
      formData.append("images", file);
    });

    const response = await fetch("http://localhost:5050/api/items/upload-images", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || "Upload failed");
    }

    return result.images as Array<{ fileName: string; url: string }>;
  }

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        await uploadImages();
      }}
    >
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={(event) => setFiles(event.target.files)}
      />
      <button type="submit">Upload</button>
    </form>
  );
}
```

### Error behavior

Upload failures return generic messages such as:

```json
{
  "success": false,
  "message": "Invalid image upload."
}
```

The server logs the rejection reason internally for auditing but does not reveal filesystem paths, parser details, or storage internals to clients.
## Backend XSS protection

Product listing input is treated as untrusted before it reaches MongoDB. The backend now strips executable markup from product text fields during create and update flows.

Implemented in these files:

- `src/utils/xss-sanitizer.ts`
  - Removes complete dangerous elements such as `<script>`, `<iframe>`, `<object>`, `<embed>`, `<svg>`, and `<form>`.
  - Removes inline event-handler attributes such as `onclick`, `onerror`, `onload`, and `onmouseover`.
  - Removes dangerous protocols such as `javascript:`, `data:`, and `vbscript:`.
  - Removes all remaining HTML tags because product descriptions do not need HTML formatting.

- `src/dtos/item.dto.ts`
  - Adds strict Zod validation and sanitization transforms for product text fields.
  - `itemName` and `phoneModel` follow title-style limits: trimmed, non-empty, max `150` characters.
  - `description` is trimmed and max `3000` characters.
  - `category` is trimmed and max `100` characters.
  - `location` is optional for backward compatibility and max `200` characters when provided.
  - `UpdateItemDto` sanitizes user product updates without changing CRUD response format.
  - `AdminUpdateItemDto` sanitizes admin product edits while preserving the existing status approval workflow.

- `src/controllers/item.controller.ts`
  - Applies sanitized DTOs during product create and owner update.

- `src/controllers/admin/item.controller.ts`
  - Applies sanitized DTOs during admin item update, protecting admin dashboard views of pending seller content.

- `src/app.ts`
  - Adds Helmet security headers, including Content Security Policy, `X-Content-Type-Options: nosniff`, and `X-Frame-Options: DENY`.

Example sanitization:

```txt
Input:  <script>alert(1)</script>iPhone
Stored: iPhone
```

Focused test command:

```powershell
$env:MONGO_URI_TEST='mongodb://localhost:27017/recell_bazar_xss_test'; npx jest src/__tests__/integration/item-xss.test.ts --runInBand --detectOpenHandles
```

The XSS tests verify valid product creation, malicious create/update sanitization, safe MongoDB storage, CRUD response format preservation, and Helmet headers.