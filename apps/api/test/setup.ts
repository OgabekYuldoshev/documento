import { randomBytes } from "node:crypto";
import pg from "pg";
import { afterAll } from "vitest";

// One isolated database per test file (cloned from the migrated template, see global-setup.ts).
const adminUrl = new URL(
  process.env.TEST_DATABASE_URL ?? "postgres://documento:documento@localhost:5480/postgres",
);
adminUrl.pathname = "/postgres";
const dbName = `documento_test_${randomBytes(6).toString("hex")}`;

const admin = new pg.Client({ connectionString: adminUrl.toString() });
await admin.connect();
await admin.query(`create database ${dbName} template documento_test_template`);

const url = new URL(adminUrl);
url.pathname = `/${dbName}`;
process.env.DATABASE_URL = url.toString();

// Imported only now so `env` and the pool see this file's DATABASE_URL.
const { pool } = await import("../src/db/client");

afterAll(async () => {
  await pool.end();
  await admin.query(`drop database if exists ${dbName} with (force)`);
  await admin.end();
});
