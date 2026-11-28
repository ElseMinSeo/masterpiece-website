// 사용: npm run db:seed:gen
import { writeFileSync } from "node:fs";
import { DEV_PLACES } from "../lib/data/places.ts";
import { buildSeedSql } from "../lib/data/seed-sql.ts";

writeFileSync(new URL("../supabase/seed.sql", import.meta.url), buildSeedSql(DEV_PLACES));
console.log(`supabase/seed.sql: 장소 ${DEV_PLACES.length}곳`);
