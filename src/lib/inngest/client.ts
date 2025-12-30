import { Inngest } from 'inngest';

// In production: uses INNGEST_EVENT_KEY env var automatically
// In development: set INNGEST_DEV=1 and optionally INNGEST_BASE_URL
export const inngest = new Inngest({
  id: 'fuel-rx',
  // Only set dev options when INNGEST_DEV is explicitly set
  ...(process.env.INNGEST_DEV === '1' && {
    isDev: true,
    baseUrl: process.env.INNGEST_BASE_URL || 'http://127.0.0.1:8288',
  }),
});
