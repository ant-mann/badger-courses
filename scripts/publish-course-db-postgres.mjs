import path from 'node:path';
import process from 'node:process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');
const COURSE_SCHEMA_PATH = path.join(repoRoot, 'scripts', 'schema-postgres.sql');
const SQLITE_BATCH_SIZE = 1000;

export const COURSE_IMPORT_TABLES = [
  'refresh_runs',
  'buildings',
  'instructors',
  'courses',
  'course_cross_listings',
  'packages',
  'sections',
  'section_instructors',
  'meetings',
  'prerequisite_rules',
  'prerequisite_nodes',
  'prerequisite_edges',
  'prerequisite_course_summaries',
  'canonical_sections',
  'canonical_meetings',
  'schedulable_packages',
  'course_search_fts',
];

export const COURSE_SWAP_TRUNCATE_TABLES = [
  'course_search_fts',
  'schedulable_packages',
  'canonical_meetings',
  'canonical_sections',
  'prerequisite_course_summaries',
  'prerequisite_edges',
  'prerequisite_nodes',
  'prerequisite_rules',
  'section_instructors',
  'meetings',
  'sections',
  'packages',
  'course_cross_listings',
  'courses',
  'instructors',
  'buildings',
  'refresh_runs',
];

export const COURSE_POSTGRES_VERIFICATION_QUERIES = [
  'SELECT COUNT(*) FROM courses',
  'SELECT COUNT(*) FROM canonical_meetings',
  'SELECT * FROM course_overview_v LIMIT 3',
  'SELECT * FROM schedule_candidates_v LIMIT 3',
];

const COURSE_RETAINED_VIEWS = [
  'course_cross_listing_overview_v',
  'prerequisite_rule_overview_v',
  'prerequisite_course_summary_overview_v',
  'section_overview_v',
  'course_overview_v',
  'schedule_planning_v',
  'schedule_candidates_v',
];
const COURSE_SCHEMA_OBJECTS = [...COURSE_IMPORT_TABLES, ...COURSE_RETAINED_VIEWS];
const COURSE_IDENTITY_COLUMNS = [
  ['refresh_runs', 'refresh_id'],
];

const COURSE_STAGING_DROP_TABLES = [...COURSE_SWAP_TRUNCATE_TABLES.slice(1), 'course_search_fts'];
const COURSE_SEARCH_FTS_COLUMNS = [
  'term_code',
  'course_id',
  'canonical_course_designation',
  'alias_course_designation',
  'alias_course_designation_normalized',
  'alias_course_designation_compact',
  'title',
  'title_normalized',
  'description',
];

export function makeCourseSearchFtsStageRow(row) {
  return {
    ...row,
    ts_source_text: [
      row.alias_course_designation,
      row.alias_course_designation_compact,
      row.title,
      row.description,
    ]
      .filter((value) => value !== null && value !== undefined && value !== '')
      .join(' '),
  };
}

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

function qualifyPublicIdentifier(identifier) {
  return `public.${escapePostgresIdentifier(identifier)}`;
}

function sqlIdentifier(sql, identifier) {
  if (typeof sql?.unsafe !== 'function') {
    return identifier;
  }

  const [schemaName, objectName] = identifier.split('.');

  if (!objectName) {
    return sql(identifier);
  }

  return sql`${sql(schemaName)}.${sql(objectName.replaceAll('"', ''))}`;
}

function createTableBatchIterator(sqlite, tableName, batchSize = SQLITE_BATCH_SIZE, mapRow = (row) => row) {
  const query = sqlite.prepare(`SELECT * FROM ${escapeSqliteIdentifier(tableName)}`);

  return (function* batchIterator() {
    let batch = [];

    for (const row of query.iterate()) {
      batch.push(mapRow(row));
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

async function createCourseStagingTables(sql) {
  for (const tableName of COURSE_IMPORT_TABLES) {
    await sql.unsafe(
      `CREATE TABLE ${qualifyPublicIdentifier(`${tableName}_staging`)} (LIKE ${qualifyPublicIdentifier(tableName)})`,
    );
  }
}

async function syncCourseIdentitySequences(sql) {
  for (const [tableName, columnName] of COURSE_IDENTITY_COLUMNS) {
    await sql.unsafe(
      `SELECT setval(pg_get_serial_sequence('public.${tableName}', '${columnName}'), COALESCE(MAX(${escapePostgresIdentifier(columnName)}), 1), MAX(${escapePostgresIdentifier(columnName)}) IS NOT NULL) FROM ${qualifyPublicIdentifier(tableName)}`,
    );
  }
}

async function loadSqliteTableIntoStage({ sqlite, sql, tableName, sqliteBatchSize = SQLITE_BATCH_SIZE }) {
  const stageTableName = qualifyPublicIdentifier(`${tableName}_staging`);

  for (const batch of createTableBatchIterator(sqlite, tableName, sqliteBatchSize)) {
    await sql`INSERT INTO ${sqlIdentifier(sql, stageTableName)} ${sql(batch)}`;
  }
}

async function loadCourseSearchFtsIntoStage({ sqlite, sql, sqliteBatchSize = SQLITE_BATCH_SIZE }) {
  const stageTableName = qualifyPublicIdentifier('course_search_fts_staging');
  const stageTableIdentifier = stageTableName;
  const columnList = COURSE_SEARCH_FTS_COLUMNS.map(escapePostgresIdentifier).join(', ');

  for (const batch of createTableBatchIterator(sqlite, 'course_search_fts', sqliteBatchSize, makeCourseSearchFtsStageRow)) {
    const parameters = [];
    const values = batch.map((row) => {
      const placeholders = COURSE_SEARCH_FTS_COLUMNS.map((columnName) => {
        parameters.push(row[columnName]);
        return `$${parameters.length}`;
      });

      parameters.push(row.ts_source_text);

      return `(${placeholders.join(', ')}, to_tsvector('simple', $${parameters.length}))`;
    });

    await sql.unsafe(
      `INSERT INTO ${stageTableIdentifier} (${columnList}, "ts") VALUES ${values.join(', ')}`,
      parameters,
    );
  }
}

function makeStageCountSql(sql) {
  const stageCountSql = async (strings, tableName) =>
    sql`SELECT COUNT(*)::int AS count FROM ${sqlIdentifier(sql, qualifyPublicIdentifier(`${tableName}_staging`))}`;

  stageCountSql.unsafe = sql.unsafe?.bind(sql);
  return stageCountSql;
}

function makeSwapSql(sql) {
  const truncateList = COURSE_SWAP_TRUNCATE_TABLES.map((tableName) => `public.${escapePostgresIdentifier(tableName)}`).join(', ');

  return sql.begin(async (transactionSql) => {
    await transactionSql.unsafe(`TRUNCATE TABLE ${truncateList}`);

    for (const tableName of COURSE_IMPORT_TABLES) {
      await transactionSql`
        INSERT INTO ${sqlIdentifier(transactionSql, qualifyPublicIdentifier(tableName))}
        SELECT * FROM ${sqlIdentifier(transactionSql, qualifyPublicIdentifier(`${tableName}_staging`))}
      `;
    }

    await syncCourseIdentitySequences(transactionSql);
  });
}

export async function dropCourseStagingTables(sql) {
  for (const tableName of COURSE_STAGING_DROP_TABLES) {
    await sql`DROP TABLE IF EXISTS ${sqlIdentifier(sql, qualifyPublicIdentifier(`${tableName}_staging`))}`;
  }
}

export async function validateRowCounts({ sqlite, sql, tables }) {
  for (const tableName of tables) {
    const sqliteCount = sqlite.prepare(`SELECT COUNT(*) FROM ${tableName}`).pluck().get();
    const [{ count: postgresCount }] = await sql(Object.assign([''], { raw: [''] }), tableName);

    if (sqliteCount !== postgresCount) {
      throw new Error(`Row count mismatch for ${tableName}: sqlite=${sqliteCount} postgres=${postgresCount}`);
    }
  }
}

export async function getCourseSchemaState(sql) {
  const existenceColumnNames = COURSE_SCHEMA_OBJECTS.map(
    (tableName) => `${tableName.replaceAll(/[^a-z0-9_]/gi, '_')}_exists`,
  );
  const columns = COURSE_SCHEMA_OBJECTS.map(
    (tableName) =>
      `to_regclass('public.${tableName}') IS NOT NULL AS ${tableName.replaceAll(/[^a-z0-9_]/gi, '_')}_exists`,
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

export async function courseBootstrapSchemaNeeded(sql) {
  return (await getCourseSchemaState(sql)) === 'missing';
}

export async function publishCourseDbPostgres({
  env = process.env,
  sqlitePath = path.join(repoRoot, 'data', 'fall-2026.sqlite'),
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

    const schemaState = await getCourseSchemaState(sql);

    if (schemaState === 'partial') {
      throw new Error('Refusing to bootstrap partially provisioned course schema');
    }

    if (schemaState === 'missing') {
      const schemaSql = await readFile(COURSE_SCHEMA_PATH, 'utf8');
      await sql.unsafe(schemaSql).simple();
    }

    await dropCourseStagingTables(sql);
    await createCourseStagingTables(sql);

    for (const tableName of COURSE_IMPORT_TABLES) {
      if (tableName === 'course_search_fts') {
        continue;
      }

      await loadSqliteTableIntoStage({ sqlite, sql, tableName, sqliteBatchSize: normalizedSqliteBatchSize });
    }

    await loadCourseSearchFtsIntoStage({ sqlite, sql, sqliteBatchSize: normalizedSqliteBatchSize });
    await validateRowCounts({
      sqlite,
      sql: makeStageCountSql(sql),
      tables: COURSE_IMPORT_TABLES,
    });
    await makeSwapSql(sql);
    await dropCourseStagingTables(sql);

    return undefined;
  } catch (error) {
    originalError = error;

    if (sql) {
      try {
        await dropCourseStagingTables(sql);
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
  await publishCourseDbPostgres({
    sqliteBatchSize: readOptionalSqliteBatchSize(process.env),
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
