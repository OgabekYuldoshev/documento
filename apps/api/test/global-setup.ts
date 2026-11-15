import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

export const TEMPLATE_DB = "documento_test_template";

/**
 * Runs once: builds a template database with every migration applied. Each test file then
 * clones it (`CREATE DATABASE ... TEMPLATE`), which is fast and fully isolated.
 */
export default async function setup() {
  const base = new URL(
    process.env.TEST_DATABASE_URL ?? "postgres://documento:documento@localhost:5480/postgres",
  );
  base.pathname = "/postgres";
  const admin = new pg.Client({ connectionString: base.toString() });
  try {
    await admin.connect();
  } catch (error) {
    throw new Error(`Cannot reach Postgres for tests (${base.host}). Start it: pnpm db:up`, {
      cause: error,
    });
  }
  await admin.query(`drop database if exists ${TEMPLATE_DB} with (force)`);
  await admin.query(`create database ${TEMPLATE_DB}`);
  await admin.end();

  const url = new URL(base);
  url.pathname = `/${TEMPLATE_DB}`;
  const pool = new pg.Pool({ connectionString: url.toString(), max: 1 });
  await migrate(drizzle(pool), {
    migrationsFolder: new URL("../src/db/migrations", import.meta.url).pathname,
  });
  await pool.end();
}
