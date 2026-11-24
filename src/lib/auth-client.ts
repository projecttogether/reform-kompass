"use client";

import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";

// Talks to /api/auth on the current origin.
export const authClient = createAuthClient({ plugins: [emailOTPClient()] });
