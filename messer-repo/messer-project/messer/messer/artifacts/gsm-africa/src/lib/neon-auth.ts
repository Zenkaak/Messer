import { createAuthClient } from "@neondatabase/neon-js/auth";

const NEON_AUTH_URL =
  (import.meta.env.VITE_NEON_AUTH_URL as string | undefined) ||
  "https://ep-young-frost-am13gy4v.neonauth.c-5.us-east-1.aws.neon.tech/neondb/auth";

export const authClient = createAuthClient(NEON_AUTH_URL);

