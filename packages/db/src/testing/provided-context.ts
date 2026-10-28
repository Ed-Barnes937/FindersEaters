// What the global setup provides to tests: the run's migrated database. Any
// module importing `@finders-eaters/db/testing` sees this type.
declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string
  }
}

export {}
