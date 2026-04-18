import path from 'node:path';
import process from 'node:process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');
const MADGRADES_SCHEMA_PATH = path.join(repoRoot, 'scripts', 'schema-madgrades-postgres.sql');
const SQLITE_BATCH_SIZE = 1000;

export const MADGRADES_IMPORT_TABLES = [
  'madgrades_refresh_runs',
  'madgrades_courses',
  'madgrades_course_subject_aliases',
  'madgrades_course_names',
  'madgrades_instructors',
  'madgrades_course_grades',
  'madgrades_course_grade_distributions',
  'madgrades_instructor_grades',
  'madgrades_instructor_grade_distributions',
  'madgrades_course_offerings',
  'madgrades_course_matches',
  'madgrades_instructor_matches',
];

export const MADGRADES_POSTGRES_VERIFICATION_QUERIES = [
  'SELECT COUNT(*) FROM madgrades.madgrades_course_matches',
];

const MADGRADES_SWAP_TRUNCATE_TABLES = [
  'madgrades_instructor_matches',
  'madgrades_course_matches',
  'madgrades_course_offerings',
  'madgrades_instructor_grade_distributions',
  'madgrades_instructor_grades',
  'madgrades_course_grade_distributions',
  'madgrades_course_grades',
  'madgrades_instructors',
  'madgrades_course_names',
  'madgrades_course_subject_aliases',
  'madgrades_courses',
  'madgrades_refresh_runs',
];

const MADGRADES_SCHEMA_OBJECTS = [...MADGRADES_IMPORT_TABLES];
const MADGRADES_REQUIRED_INDEXES = [
  'idx_madgrades_courses_designation',
  'idx_madgrades_course_subject_aliases_course',
  'idx_madgrades_course_names_course',
  'idx_madgrades_course_grades_course_term',
  'idx_madgrades_course_offerings_course_instructor_term',
  'idx_madgrades_instructor_grades_instructor_term',
  'idx_madgrades_course_matches_course',
  'idx_madgrades_instructor_matches_instructor',
];
const MADGRADES_SCHEMA_STATE_OBJECTS = [...MADGRADES_IMPORT_TABLES, ...MADGRADES_REQUIRED_INDEXES];
const MADGRADES_IDENTITY_COLUMNS = [
  ['madgrades_refresh_runs', 'madgrades_refresh_run_id'],
  ['madgrades_courses', 'madgrades_course_id'],
  ['madgrades_instructors', 'madgrades_instructor_id'],
  ['madgrades_course_grades', 'madgrades_course_grade_id'],
  ['madgrades_course_grade_distributions', 'madgrades_course_grade_distribution_id'],
  ['madgrades_instructor_grades', 'madgrades_instructor_grade_id'],
  ['madgrades_instructor_grade_distributions', 'madgrades_instructor_grade_distribution_id'],
  ['madgrades_course_offerings', 'madgrades_course_offering_id'],
];

export function requireEnv(env, name) {
  const value = env[name];

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

function normalizeSqliteBatchSize(sqliteBatchSize) {
  if (!Number.isInteger(sqliteBatchSize) || sqliteBatchSize < 1) {
    throw new Error('sqliteBatchSize must be a positive integer');
  }

  return sqliteBatchSize;
}

function readOptionalSqliteBatchSize(env) {
  const value = env.SQLITE_BATCH_SIZE;

  if (value === undefined || value === '') {
    return SQLITE_BATCH_SIZE;
  }

  return normalizeSqliteBatchSize(Number(value));
}

function escapeSqliteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function escapePostgresIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function qualifyMadgradesIdentifier(identifier) {
  return `madgrades.${escapePostgresIdentifier(identifier)}`;
}

function sqlIdentifier(sql, identifier) {
  if (typeof sql?.unsafe === 'function') {
    return sql.unsafe(identifier.includes('.') ? identifier : escapePostgresIdentifier(identifier));
  }

  return identifier;
}

function createTableBatchIterator(sqlite, tableName, batchSize = SQLITE_BATCH_SIZE) {
  const query = sqlite.prepare(`SELECT * FROM ${escapeSqliteIdentifier(tableName)}`);

  return (function* batchIterator() {
    let batch = [];

    for (const row of query.iterate()) {
      batch.push(row);
      if (batch.length === batchSize) {
        yield batch;
        batch = [];
      }
    }

    if (batch.length > 0) {
      yield batch;
    }
  })();
}

export async function dropMadgradesStagingTables(sql) {
  for (const tableName of [...MADGRADES_IMPORT_TABLES].reverse()) {
    await sql.unsafe(`DROP TABLE IF EXISTS ${qualifyMadgradesIdentifier(`${tableName}_staging`)}`);
  }
}

export async function validateMadgradesRowCounts({ sqlite, sql, tables }) {
  for (const tableName of tables) {
    const sqliteCount = sqlite.prepare(`SELECT COUNT(*) FROM ${escapeSqliteIdentifier(tableName)}`).pluck().get();
    const [{ count: postgresCount }] = await sql`
      SELECT COUNT(*)::int AS count FROM ${sqlIdentifier(sql, qualifyMadgradesIdentifier(`${tableName}_staging`))}
    `;

    if (sqliteCount !== postgresCount) {
      throw new Error(`Row count mismatch for ${tableName}: sqlite=${sqliteCount} postgres=${postgresCount}`);
    }
  }
}

async function createMadgradesStagingTables(sql) {
  for (const tableName of MADGRADES_IMPORT_TABLES) {
    await sql.unsafe(
      `CREATE TABLE ${qualifyMadgradesIdentifier(`${tableName}_staging`)} (LIKE ${qualifyMadgradesIdentifier(tableName)})`,
    );
  }
}

async function loadSqliteTableIntoStage({ sqlite, sql, tableName, sqliteBatchSize = SQLITE_BATCH_SIZE }) {
  const stageTableName = qualifyMadgradesIdentifier(`${tableName}_staging`);

  for (const batch of createTableBatchIterator(sqlite, tableName, sqliteBatchSize)) {
    await sql`INSERT INTO ${sqlIdentifier(sql, stageTableName)} ${sql(batch)}`;
  }
}

async function swapMadgradesTables(sql) {
  const truncateList = MADGRADES_SWAP_TRUNCATE_TABLES.map((tableName) => qualifyMadgradesIdentifier(tableName)).join(', ');

  await sql.begin(async (transactionSql) => {
    await transactionSql.unsafe(`TRUNCATE TABLE ${truncateList}`);

    for (const tableName of MADGRADES_IMPORT_TABLES) {
      await transactionSql.unsafe(
        `INSERT INTO ${qualifyMadgradesIdentifier(tableName)} SELECT * FROM ${qualifyMadgradesIdentifier(`${tableName}_staging`)}`,
      );
    }

    for (const [tableName, columnName] of MADGRADES_IDENTITY_COLUMNS) {
      await transactionSql.unsafe(
        `SELECT setval(pg_get_serial_sequence('madgrades.${tableName}', '${columnName}'), COALESCE(MAX(${escapePostgresIdentifier(columnName)}), 1), MAX(${escapePostgresIdentifier(columnName)}) IS NOT NULL) FROM ${qualifyMadgradesIdentifier(tableName)}`,
      );
    }
  });
}

export async function getMadgradesSchemaState(sql) {
  const existenceColumnNames = MADGRADES_SCHEMA_STATE_OBJECTS.map(
    (tableName) => `${tableName.replaceAll(/[^a-z0-9_]/gi, '_')}_exists`,
  );
  const columns = MADGRADES_SCHEMA_STATE_OBJECTS.map((objectName) => {
    const objectPath = MADGRADES_REQUIRED_INDEXES.includes(objectName)
      ? `madgrades.${objectName}`
      : `madgrades.${objectName}`;

    return `to_regclass('${objectPath}') IS NOT NULL AS ${objectName.replaceAll(/[^a-z0-9_]/gi, '_')}_exists`;
  }
  ).join(', ');
  const query = `SELECT ${columns}`;
  const rows =
    typeof sql.unsafe === 'function'
      ? await sql.unsafe(query)
      : await sql(Object.assign([query], { raw: [query] }));
  const [row] = rows;
  const existingTableCount = existenceColumnNames.filter((columnName) => row?.[columnName]).length;

  if (existingTableCount === 0) {
    return 'missing';
  }

  if (existingTableCount === existenceColumnNames.length) {
    return 'present';
  }

  return 'partial';
}

export async function madgradesBootstrapSchemaNeeded(sql) {
  return (await getMadgradesSchemaState(sql)) === 'missing';
}

export async function publishMadgradesDbPostgres({
  env = process.env,
  sqlitePath = path.join(repoRoot, 'data', 'fall-2026-madgrades.sqlite'),
  schemaPath = MADGRADES_SCHEMA_PATH,
  sqliteBatchSize = SQLITE_BATCH_SIZE,
  sqlFactory = postgres,
} = {}) {
  const normalizedSqliteBatchSize = normalizeSqliteBatchSize(sqliteBatchSize);
  const databaseUrl = requireEnv(env, 'SUPABASE_DATABASE_URL');
  let sql;
  let sqlite;
  let originalError;

  try {
    sql = sqlFactory(databaseUrl);
    sqlite = new Database(sqlitePath, { readonly: true, fileMustExist: true });

    const schemaState = await getMadgradesSchemaState(sql);

    if (schemaState === 'partial') {
      throw new Error('Refusing to bootstrap partially provisioned madgrades schema');
    }

    if (schemaState === 'missing') {
      const schemaSql = await readFile(schemaPath, 'utf8');
      await sql.begin(async (transactionSql) => {
        await transactionSql.unsafe(schemaSql).simple();
      });
    }

    await dropMadgradesStagingTables(sql);
    await createMadgradesStagingTables(sql);

    for (const tableName of MADGRADES_IMPORT_TABLES) {
      await loadSqliteTableIntoStage({ sqlite, sql, tableName, sqliteBatchSize: normalizedSqliteBatchSize });
    }

    await validateMadgradesRowCounts({
      sqlite,
      sql,
      tables: MADGRADES_IMPORT_TABLES,
    });
    await swapMadgradesTables(sql);
    await dropMadgradesStagingTables(sql);

    return undefined;
  } catch (error) {
    originalError = error;

    if (sql) {
      try {
        await dropMadgradesStagingTables(sql);
      } catch {
        // Preserve the original publish failure if staging cleanup also fails.
      }
    }

    throw error;
  } finally {
    sqlite?.close();

    if (sql) {
      try {
        await sql.end({ timeout: 0 });
      } catch (error) {
        if (!originalError) {
          throw error;
        }
      }
    }
  }
}

async function main() {
  await publishMadgradesDbPostgres({
    sqliteBatchSize: readOptionalSqliteBatchSize(process.env),
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
