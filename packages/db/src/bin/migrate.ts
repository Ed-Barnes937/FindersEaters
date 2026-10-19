// Applies pending migrations to DATABASE_URL: `pnpm --filter @finders-eaters/db migrate`.
import { migrateDatabase } from '../migrate.ts'

const url = process.env.DATABASE_URL
if (!url) {
  process.stderr.write('DATABASE_URL is not set\n')
  process.exit(2)
}

await migrateDatabase(url)
process.stdout.write('Migrations applied.\n')
