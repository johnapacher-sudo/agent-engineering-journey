// import {neon} from "@neondatabase/serverless"
// import {drizzle} from "drizzle-orm/neon-serverless"
// import * as schema from './schema';
// const sql = neon(process.env.DATABASE_URL!);
// export const db = drizzle(sql, { schema, logger: true });

import {neon, neonConfig, Pool} from "@neondatabase/serverless"
import {drizzle} from "drizzle-orm/neon-serverless"
import * as schema from './schema';

neonConfig.pipelineConnect = false;
neonConfig.wsProxy = (host, port) => `${host}/v2?address=${host}:${port}`;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({client: pool, schema, logger: true });