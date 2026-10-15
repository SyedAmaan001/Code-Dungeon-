/**
 * npm run db:migrate          apply pending migrations to DATABASE_URL
 * npm run db:migrate -- --status   list migration state without changing anything
 */
import { join } from "node:path";
import { createSql, describeUrl } from "../../src/db/client";
import { migrate, migrationStatus } from "../../src/db/migrate";

const dir = join(process.cwd(), "db", "migrations");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. For local development run: npm run db:local -- start");
  process.exit(1);
}

const sql = createSql({ url, max: 1 });
try {
  console.log(`Database: ${describeUrl(url)}`);
  if (process.argv.includes("--status")) {
    for (const row of await migrationStatus(sql, dir))
      console.log(`  ${row.state.padEnd(8)} ${row.migration}`);
  } else {
    const report = await migrate(sql, dir);
    for (const m of report.alreadyApplied) console.log(`  already applied ${m}`);
    for (const m of report.applied) console.log(`  applied         ${m}`);
    console.log(
      `${report.applied.length} migration(s) applied, ${report.alreadyApplied.length} already up to date`,
    );
  }
} catch (err) {
  console.error(`Migration failed: ${(err as Error).message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
