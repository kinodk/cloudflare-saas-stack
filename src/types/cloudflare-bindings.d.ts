declare global {
  interface CloudflareEnv {
    AUTH_GOOGLE_ID: string;
    AUTH_GOOGLE_SECRET: string;
    BETTER_AUTH_SECRET: string;
    INNGEST_EVENT_KEY: string;
    INNGEST_SIGNING_KEY: string;
    NEXT_PUBLIC_AUTH_URL: string;
    DATABASE: D1Database;
    BUCKET: R2Bucket;
    AI: Ai;
    ASSETS: Fetcher;
    EXAMPLE_WORKFLOW: Workflow;
  }
}

export {};
