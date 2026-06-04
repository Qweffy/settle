import { drizzle } from 'drizzle-orm/neon-http';
import { neon, neonConfig } from '@neondatabase/serverless';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env.local and add your Neon connection string.',
  );
}

// Tests run against a local Postgres + neon-http proxy (docker). When the URL
// points at the proxy host, route the driver's HTTP fetch to it. No effect in
// production — real Neon hosts don't match.
if (connectionString.includes('localtest.me') || process.env.NEON_LOCAL) {
  neonConfig.fetchEndpoint = (host) => `http://${host}:4444/sql`;
  neonConfig.useSecureWebSocket = false;
  neonConfig.poolQueryViaFetch = true;
}

export const db = drizzle(neon(connectionString), { schema });
export { schema };
