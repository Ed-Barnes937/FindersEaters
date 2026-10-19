// The values the global setup hands to test workers (see ./global-setup.ts).
declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string
  }
}

export {}
