import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import Database from 'better-sqlite3';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const courseImporterPath = path.join(repoRoot, 'scripts', 'publish-course-db-postgres.mjs');
const madgradesImporterPath = path.join(repoRoot, 'scripts', 'publish-madgrades-db-postgres.mjs');

const expectedCourseImportTables = [
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

const expectedCourseRetainedViews = [
  'course_cross_listing_overview_v',
  'prerequisite_rule_overview_v',
  'prerequisite_course_summary_overview_v',
  'section_overview_v',
  'course_overview_v',
  'schedule_planning_v',
  'schedule_candidates_v',
];

const expectedCourseSwapTruncateTables = [
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

const expectedCourseVerificationQueries = [
  'SELECT COUNT(*) FROM courses',
  'SELECT COUNT(*) FROM canonical_meetings',
  'SELECT * FROM course_overview_v LIMIT 3',
  'SELECT * FROM schedule_candidates_v LIMIT 3',
];

const expectedMadgradesImportTables = [
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

const expectedMadgradesRequiredIndexes = [
  'idx_madgrades_courses_designation',
  'idx_madgrades_course_subject_aliases_course',
  'idx_madgrades_course_names_course',
  'idx_madgrades_course_grades_course_term',
  'idx_madgrades_course_offerings_course_instructor_term',
  'idx_madgrades_instructor_grades_instructor_term',
  'idx_madgrades_course_matches_course',
  'idx_madgrades_instructor_matches_instructor',
];

const expectedMadgradesVerificationQueries = [
  'SELECT COUNT(*) FROM madgrades.madgrades_course_matches',
];

const expectedMadgradesSequenceSyncEvents = [
  'sequence-sync:transaction:madgrades_refresh_runs.madgrades_refresh_run_id',
  'sequence-sync:transaction:madgrades_courses.madgrades_course_id',
  'sequence-sync:transaction:madgrades_instructors.madgrades_instructor_id',
  'sequence-sync:transaction:madgrades_course_grades.madgrades_course_grade_id',
  'sequence-sync:transaction:madgrades_course_grade_distributions.madgrades_course_grade_distribution_id',
  'sequence-sync:transaction:madgrades_instructor_grades.madgrades_instructor_grade_id',
  'sequence-sync:transaction:madgrades_instructor_grade_distributions.madgrades_instructor_grade_distribution_id',
  'sequence-sync:transaction:madgrades_course_offerings.madgrades_course_offering_id',
];

function makeMadgradesSchemaExistsRow(overrides = {}) {
  return Object.fromEntries(
    [...expectedMadgradesImportTables, ...expectedMadgradesRequiredIndexes].map((objectName) => [
      `${objectName}_exists`,
      overrides[`${objectName}_exists`] ?? true,
    ]),
  );
}

function makeCourseSchemaExistsRow(overrides = {}) {
  return Object.fromEntries(
    [...expectedCourseImportTables, ...expectedCourseRetainedViews]
      .map((tableName) => [`${tableName}_exists`, overrides[`${tableName}_exists`] ?? true]),
  );
}

function createCourseSchemaStubSql({ schemaExistsRow, stopMessage, onBootstrapApply = () => {} }) {
  const sql = (strings, ...values) => {
    if (Array.isArray(strings) && Object.hasOwn(strings, 'raw')) {
      const isIdentifierFragment =
        strings.length === values.length + 1
        && strings.every((part) => part === '' || part === '.')
        && values.every((value) => value?.kind === 'identifier');

      if (isIdentifierFragment) {
        return {
          kind: 'identifier',
          render() {
            let statement = '';

            for (let index = 0; index < strings.length; index += 1) {
              statement += strings[index];
              if (index < values.length) {
                statement += values[index].value;
              }
            }

            return statement;
          },
        };
      }

      throw new Error(stopMessage);
    }

    if (typeof strings === 'string') {
      return { kind: 'identifier', value: strings };
    }

    throw new Error(stopMessage);
  };

  sql.unsafe = (query) => {
    if (query.includes('to_regclass')) {
      return Promise.resolve([schemaExistsRow]);
    }

    return {
      async simple() {
        onBootstrapApply(query);
      },
    };
  };
  sql.begin = async () => {
    throw new Error('sql.begin should not be called in this test');
  };
  sql.end = async () => {};

  return sql;
}

async function createCourseSqliteFixture({
  withRows = false,
  rowCount = withRows ? 1 : 0,
  rowCountsByTable = {},
} = {}) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'postgres-publish-test-'));
  const sqlitePath = path.join(tempDir, 'course.sqlite');
  const db = new Database(sqlitePath);

  try {
    for (const tableName of expectedCourseImportTables) {
      const tableRowCount = rowCountsByTable[tableName] ?? rowCount;

      if (tableName === 'course_search_fts') {
        db.exec(`CREATE TABLE ${tableName} (
          term_code TEXT,
          course_id TEXT,
          canonical_course_designation TEXT,
          alias_course_designation TEXT,
          alias_course_designation_normalized TEXT,
          alias_course_designation_compact TEXT,
          title TEXT,
          title_normalized TEXT,
          description TEXT
        )`);

        if (tableRowCount > 0) {
          const statement = db.prepare(`INSERT INTO ${tableName} (
            term_code,
            course_id,
            canonical_course_designation,
            alias_course_designation,
            alias_course_designation_normalized,
            alias_course_designation_compact,
            title,
            title_normalized,
            description
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

          for (let index = 1; index <= tableRowCount; index += 1) {
            statement.run(
              '2026',
              String(index),
              `COMP SCI 40${index}`,
              `COMP SCI 40${index}`,
              `comp sci 40${index}`,
              `COMPSCI40${index}`,
              `Programming ${index}`,
              `programming ${index}`,
              `Advanced programming topic ${index}`,
            );
          }
        }

        continue;
      }

      db.exec(`CREATE TABLE ${tableName} (id INTEGER)`);

      if (tableRowCount > 0) {
        const statement = db.prepare(`INSERT INTO ${tableName} (id) VALUES (?)`);

        for (let index = 1; index <= tableRowCount; index += 1) {
          statement.run(index);
        }
      }
    }
  } finally {
    db.close();
  }

  return {
    sqlitePath,
    async cleanup() {
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

async function createMadgradesSqliteFixture({
  withRows = false,
  rowCount = withRows ? 1 : 0,
  rowCountsByTable = {},
} = {}) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'postgres-publish-test-'));
  const sqlitePath = path.join(tempDir, 'madgrades.sqlite');
  const db = new Database(sqlitePath);

  try {
    for (const tableName of expectedMadgradesImportTables) {
      const tableRowCount = rowCountsByTable[tableName] ?? rowCount;

      db.exec(`CREATE TABLE ${tableName} (id INTEGER)`);

      if (tableRowCount > 0) {
        const statement = db.prepare(`INSERT INTO ${tableName} (id) VALUES (?)`);

        for (let index = 1; index <= tableRowCount; index += 1) {
          statement.run(index);
        }
      }
    }
  } finally {
    db.close();
  }

  return {
    sqlitePath,
    async cleanup() {
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

function createPostgresRecorder({
  schemaExistsRow,
  stageCount = 1,
  stageCountsByTable = {},
  swapError,
  cleanupError,
  rejectTemplateCreateStatements = false,
  rejectTemplateUnsafeIdentifierFragments = false,
}) {
  const events = [];
  let dropCallCount = 0;
  let insideTransaction = false;

  function record(event) {
    events.push(event);
  }

  function renderValue(value) {
    if (value?.kind === 'identifier') {
      return value.render?.() ?? value.value;
    }

    if (value?.kind === 'unsafe-identifier') {
      return value.value;
    }

    if (value?.kind === 'batch') {
      return '[batch]';
    }

    return String(value);
  }

  function renderStatement(strings, values) {
    let statement = '';

    for (let index = 0; index < strings.length; index += 1) {
      statement += strings[index];
      if (index < values.length) {
        statement += renderValue(values[index]);
      }
    }

    return statement.replace(/\s+/g, ' ').trim();
  }

  function isIdentifierFragment(strings, values) {
    if (strings.length !== values.length + 1) {
      return false;
    }

    if (!values.every((value) => value?.kind === 'identifier' || value?.kind === 'unsafe-identifier')) {
      return false;
    }

    return strings.every((part) => part === '' || part === '.');
  }

  function tableNameFromStatement(statement, prefix) {
    return statement.slice(prefix.length).trim().replaceAll('"', '');
  }

  function hasUnsafeIdentifierFragment(values) {
    return values.some((value) => value?.kind === 'unsafe-identifier');
  }

  async function handleTemplate(strings, values, phase = 'main') {
    const statement = renderStatement(strings, values);

    if (statement.startsWith('DROP TABLE IF EXISTS ')) {
      dropCallCount += 1;
      record(`drop:${tableNameFromStatement(statement, 'DROP TABLE IF EXISTS ')}`);

      if (phase === 'main' && cleanupError && dropCallCount > expectedCourseImportTables.length) {
        throw cleanupError;
      }

      return [];
    }

    if (statement.startsWith('CREATE TABLE ')) {
      if (rejectTemplateCreateStatements) {
        throw new Error('syntax error at or near "public"');
      }

      record(`create:${tableNameFromStatement(statement, 'CREATE TABLE ').split(' ')[0]}`);
      return [];
    }

    if (statement.startsWith('INSERT INTO ') && statement.includes('[batch]')) {
      if (rejectTemplateUnsafeIdentifierFragments && hasUnsafeIdentifierFragment(values)) {
        throw new Error(`relation "${tableNameFromStatement(statement, 'INSERT INTO ').split(' ')[0]}" does not exist`);
      }

      record(`load:${tableNameFromStatement(statement, 'INSERT INTO ').split(' ')[0]}`);
      return [];
    }

    if (statement.startsWith('SELECT COUNT(*)::int AS count FROM ')) {
      if (rejectTemplateUnsafeIdentifierFragments && hasUnsafeIdentifierFragment(values)) {
        throw new Error(`relation "${tableNameFromStatement(statement, 'SELECT COUNT(*)::int AS count FROM ')}" does not exist`);
      }

      const tableName = tableNameFromStatement(statement, 'SELECT COUNT(*)::int AS count FROM ')
        .replace(/^public\./, '')
        .replace(/"/g, '')
        .replace(/_staging$/, '');
      record(`validate:${tableName}`);
      return [{ count: stageCountsByTable[tableName] ?? stageCount }];
    }

    if (statement.startsWith('INSERT INTO ') && statement.includes(' SELECT * FROM ')) {
      if (rejectTemplateUnsafeIdentifierFragments && hasUnsafeIdentifierFragment(values)) {
        throw new Error(`relation "${tableNameFromStatement(statement, 'INSERT INTO ').split(' ')[0]}" does not exist`);
      }

      record(`swap:${tableNameFromStatement(statement, 'INSERT INTO ').split(' ')[0]}`);
      return [];
    }

    throw new Error(`Unexpected SQL statement: ${statement}`);
  }

  function makeSql(phase = 'main') {
    const sql = (strings, ...values) => {
      if (Array.isArray(strings) && Object.hasOwn(strings, 'raw')) {
        if (isIdentifierFragment(strings, values)) {
          return {
            kind: 'identifier',
            render() {
              return renderStatement(strings, values);
            },
          };
        }

        return handleTemplate(strings, values, phase);
      }

      if (typeof strings === 'string') {
        return { kind: 'identifier', value: strings };
      }

      return { kind: 'batch', value: strings };
    };

    sql.unsafe = (query, parameters) => {
      if (typeof query !== 'string') {
        throw new Error('Unexpected non-string sql.unsafe query');
      }

      if (!query.includes(' ') && (/^".*"$/.test(query) || /^public\.".*"$/.test(query))) {
        return { kind: 'unsafe-identifier', value: query };
      }

      if (query.includes('to_regclass')) {
        record('bootstrap-check');
        return Promise.resolve([schemaExistsRow]);
      }

      if (query.startsWith('INSERT INTO public."course_search_fts_staging"')) {
        assert.equal(parameters.length, 10);
        record('load:public.course_search_fts_staging');
        return Promise.resolve([]);
      }

      if (query.startsWith('CREATE TABLE public."')) {
        record(`create:${tableNameFromStatement(query, 'CREATE TABLE ').split(' ')[0]}`);
        return Promise.resolve([]);
      }

      if (query.startsWith('TRUNCATE TABLE ')) {
        record('swap-truncate');

        if (swapError) {
          throw swapError;
        }

        return Promise.resolve([]);
      }

      if (query.includes('pg_get_serial_sequence')) {
        record(`sequence-sync:${insideTransaction ? 'transaction' : 'outside'}:refresh_runs.refresh_id`);
        return Promise.resolve([]);
      }

      return {
        async simple() {
          record('bootstrap-apply');
          return undefined;
        },
      };
    };

    sql.begin = async (callback) => {
      record('swap-begin');
      insideTransaction = true;

      try {
        return await callback(makeSql('transaction'));
      } finally {
        insideTransaction = false;
      }
    };

    sql.end = async (options) => {
      assert.deepEqual(options, { timeout: 0 });
      record('end');
    };

    return sql;
  }

  return {
    events,
    sqlFactory() {
      return makeSql();
    },
  };
}

function createMadgradesPostgresRecorder({
  schemaExistsRow = makeMadgradesSchemaExistsRow(Object.fromEntries(
    [...expectedMadgradesImportTables, ...expectedMadgradesRequiredIndexes].map((tableName) => [`${tableName}_exists`, false]),
  )),
  stageCount = 1,
  stageCountsByTable = {},
  swapError,
  cleanupError,
  bootstrapError,
} = {}) {
  const events = [];
  let dropCallCount = 0;
  let insideTransaction = false;
  let beginCallCount = 0;

  function record(event) {
    events.push(event);
  }

  function renderValue(value) {
    if (value?.kind === 'identifier') {
      return value.value;
    }

    if (value?.kind === 'batch') {
      return '[batch]';
    }

    return String(value);
  }

  function renderStatement(strings, values) {
    let statement = '';

    for (let index = 0; index < strings.length; index += 1) {
      statement += strings[index];
      if (index < values.length) {
        statement += renderValue(values[index]);
      }
    }

    return statement.replace(/\s+/g, ' ').trim();
  }

  function tableNameFromStatement(statement, prefix) {
    return statement.slice(prefix.length).trim().replaceAll('"', '');
  }

  async function handleTemplate(strings, values) {
    const statement = renderStatement(strings, values);

    if (statement.startsWith('INSERT INTO ') && statement.includes('[batch]')) {
      record(`load:${tableNameFromStatement(statement, 'INSERT INTO ').split(' ')[0]}`);
      return [];
    }

    if (statement.startsWith('SELECT COUNT(*)::int AS count FROM ')) {
      const tableName = tableNameFromStatement(statement, 'SELECT COUNT(*)::int AS count FROM ')
        .replace(/^madgrades\./, '')
        .replace(/_staging$/, '');
      record(`validate:${tableName}`);
      return [{ count: stageCountsByTable[tableName] ?? stageCount }];
    }

    throw new Error(`Unexpected SQL statement: ${statement}`);
  }

  function makeSql() {
    const sql = (strings, ...values) => {
      if (Array.isArray(strings) && Object.hasOwn(strings, 'raw')) {
        return handleTemplate(strings, values);
      }

      if (typeof strings === 'string') {
        return { kind: 'identifier', value: strings };
      }

      return { kind: 'batch', value: strings };
    };

    sql.unsafe = (query) => {
      if (!query.includes(' ') && /^madgrades\.".*"$/.test(query)) {
        return { kind: 'identifier', value: query };
      }

      if (query.includes('to_regclass')) {
        record('bootstrap-check');
        return Promise.resolve([schemaExistsRow]);
      }

      if (query.includes('CREATE SCHEMA IF NOT EXISTS madgrades;')) {
        return {
          async simple() {
            if (bootstrapError) {
              throw bootstrapError;
            }

            record('bootstrap-apply');
          },
        };
      }

      if (query.startsWith('DROP TABLE IF EXISTS ')) {
        dropCallCount += 1;
        record(`drop:${tableNameFromStatement(query, 'DROP TABLE IF EXISTS ')}`);

        if (cleanupError && dropCallCount > expectedMadgradesImportTables.length) {
          return Promise.reject(cleanupError);
        }

        return Promise.resolve([]);
      }

      if (query.startsWith('CREATE TABLE ')) {
        record(`create:${tableNameFromStatement(query, 'CREATE TABLE ').split(' ')[0]}`);
        return Promise.resolve([]);
      }

      if (query.startsWith('TRUNCATE TABLE ')) {
        record('swap-truncate');

        if (swapError) {
          return Promise.reject(swapError);
        }

        return Promise.resolve([]);
      }

      if (query.startsWith('INSERT INTO madgrades.') && query.includes(' SELECT * FROM madgrades.')) {
        record(`swap:${tableNameFromStatement(query, 'INSERT INTO ').split(' ')[0]}`);
        return Promise.resolve([]);
      }

      if (query.includes('pg_get_serial_sequence')) {
        const sequenceMatches = [
          ['madgrades.madgrades_refresh_runs', 'madgrades_refresh_runs.madgrades_refresh_run_id'],
          ['madgrades.madgrades_courses', 'madgrades_courses.madgrades_course_id'],
          ['madgrades.madgrades_instructors', 'madgrades_instructors.madgrades_instructor_id'],
          ['madgrades.madgrades_course_grades', 'madgrades_course_grades.madgrades_course_grade_id'],
          [
            'madgrades.madgrades_course_grade_distributions',
            'madgrades_course_grade_distributions.madgrades_course_grade_distribution_id',
          ],
          ['madgrades.madgrades_instructor_grades', 'madgrades_instructor_grades.madgrades_instructor_grade_id'],
          [
            'madgrades.madgrades_instructor_grade_distributions',
            'madgrades_instructor_grade_distributions.madgrades_instructor_grade_distribution_id',
          ],
          ['madgrades.madgrades_course_offerings', 'madgrades_course_offerings.madgrades_course_offering_id'],
        ];
        const match = sequenceMatches.find(([sequenceName]) => query.includes(`pg_get_serial_sequence('${sequenceName}'`));

        if (!match) {
          throw new Error(`Unexpected madgrades sequence sync query: ${query}`);
        }

        record(`sequence-sync:${insideTransaction ? 'transaction' : 'outside'}:${match[1]}`);
        return Promise.resolve([]);
      }

      throw new Error(`Unexpected unsafe SQL statement: ${query}`);
    };

    sql.begin = async (callback) => {
      beginCallCount += 1;
      record(beginCallCount === 1 ? 'bootstrap-begin' : 'swap-begin');
      insideTransaction = true;

      try {
        return await callback(sql);
      } finally {
        insideTransaction = false;
      }
    };

    sql.end = async (options) => {
      assert.deepEqual(options, { timeout: 0 });
      record('end');
    };

    return sql;
  }

  return {
    events,
    sqlFactory() {
      return makeSql();
    },
  };
}

test('package.json wires postgres publishing scripts and dependency', async () => {
  const packageJson = JSON.parse(
    await readFile(path.join(repoRoot, 'package.json'), 'utf8'),
  );

  assert.equal(packageJson.dependencies.postgres, '^3.4.5');
  assert.equal(
    packageJson.scripts['publish:course-db:postgres'],
    'node scripts/publish-course-db-postgres.mjs',
  );
  assert.equal(
    packageJson.scripts['publish:madgrades-db:postgres'],
    'node scripts/publish-madgrades-db-postgres.mjs',
  );
});

test('course postgres publish script exports the expected table orders', async () => {
  const module = await import(courseImporterPath);

  assert.deepEqual(module.COURSE_IMPORT_TABLES, expectedCourseImportTables);
  assert.deepEqual(module.COURSE_SWAP_TRUNCATE_TABLES, expectedCourseSwapTruncateTables);
});

test('postgres publish scripts export the documented verification queries', async () => {
  const courseModule = await import(courseImporterPath);
  const madgradesModule = await import(madgradesImporterPath);

  assert.deepEqual(
    courseModule.COURSE_POSTGRES_VERIFICATION_QUERIES,
    expectedCourseVerificationQueries,
  );
  assert.deepEqual(
    madgradesModule.MADGRADES_POSTGRES_VERIFICATION_QUERIES,
    expectedMadgradesVerificationQueries,
  );
});

test('makeCourseSearchFtsStageRow adds ts_source_text from the searchable fields', async () => {
  const { makeCourseSearchFtsStageRow } = await import(courseImporterPath);
  const row = {
    alias_course_designation: 'COMP SCI 400',
    alias_course_designation_compact: 'COMPSCI400',
    title: 'Programming III',
    description: 'Advanced programming topics',
    course_id: 400,
  };

  assert.deepEqual(makeCourseSearchFtsStageRow(row), {
    ...row,
    ts_source_text: 'COMP SCI 400 COMPSCI400 Programming III Advanced programming topics',
  });
});

test('dropCourseStagingTables drops course staging tables in dependency-safe order', async () => {
  const { dropCourseStagingTables } = await import(courseImporterPath);
  const statements = [];
  const sql = async (strings, tableName) => {
    statements.push(strings[0] + tableName + strings[1]);
  };

  await dropCourseStagingTables(sql);

  assert.deepEqual(statements, [
    'DROP TABLE IF EXISTS public."schedulable_packages_staging"',
    'DROP TABLE IF EXISTS public."canonical_meetings_staging"',
    'DROP TABLE IF EXISTS public."canonical_sections_staging"',
    'DROP TABLE IF EXISTS public."prerequisite_course_summaries_staging"',
    'DROP TABLE IF EXISTS public."prerequisite_edges_staging"',
    'DROP TABLE IF EXISTS public."prerequisite_nodes_staging"',
    'DROP TABLE IF EXISTS public."prerequisite_rules_staging"',
    'DROP TABLE IF EXISTS public."section_instructors_staging"',
    'DROP TABLE IF EXISTS public."meetings_staging"',
    'DROP TABLE IF EXISTS public."sections_staging"',
    'DROP TABLE IF EXISTS public."packages_staging"',
    'DROP TABLE IF EXISTS public."course_cross_listings_staging"',
    'DROP TABLE IF EXISTS public."courses_staging"',
    'DROP TABLE IF EXISTS public."instructors_staging"',
    'DROP TABLE IF EXISTS public."buildings_staging"',
    'DROP TABLE IF EXISTS public."refresh_runs_staging"',
    'DROP TABLE IF EXISTS public."course_search_fts_staging"',
  ]);
});

test('validateRowCounts throws the exact mismatch message when counts differ', async () => {
  const { validateRowCounts } = await import(courseImporterPath);
  const sqlite = {
    prepare(statement) {
      assert.equal(statement, 'SELECT COUNT(*) FROM courses');
      return {
        pluck() {
          return {
            get() {
              return 3;
            },
          };
        },
      };
    },
  };
  const sql = async (strings, tableName) => {
    assert.equal(strings[0], '');
    assert.equal(tableName, 'courses');
    return [{ count: 2 }];
  };

  await assert.rejects(
    validateRowCounts({ sqlite, sql, tables: ['courses'] }),
    /Row count mismatch for courses: sqlite=3 postgres=2/,
  );
});

test('publishCourseDbPostgres loads packages_staging through a valid SQL path before ordinary staging validation', async () => {
  const { publishCourseDbPostgres } = await import(courseImporterPath);
  const fixture = await createCourseSqliteFixture({ withRows: true });
  const recorder = createPostgresRecorder({
    schemaExistsRow: makeCourseSchemaExistsRow(),
    rejectTemplateUnsafeIdentifierFragments: true,
  });

  try {
    await publishCourseDbPostgres({
      env: {
        SUPABASE_DATABASE_URL: 'postgres://example.test/db',
      },
      sqlitePath: fixture.sqlitePath,
      sqlFactory: recorder.sqlFactory,
    });

    assert.ok(
      recorder.events.indexOf('create:public.packages_staging') !== -1,
      'expected packages staging table creation to succeed',
    );
    assert.ok(
      recorder.events.indexOf('load:public.packages_staging') !== -1,
      'expected packages staging rows to load through a valid SQL path',
    );
    assert.ok(
      recorder.events.indexOf('create:public.packages_staging')
        < recorder.events.indexOf('load:public.packages_staging'),
      'expected packages staging table creation before ordinary staging load',
    );
    assert.ok(
      recorder.events.indexOf('load:public.packages_staging')
        < recorder.events.indexOf('validate:packages'),
      'expected packages staging rows to load before row-count validation',
    );
  } finally {
    await fixture.cleanup();
  }
});

test('courseBootstrapSchemaNeeded returns false when only some required course tables are missing', async () => {
  const { courseBootstrapSchemaNeeded } = await import(courseImporterPath);
  const sql = async (strings) => {
    const statement = Array.isArray(strings) ? strings.join('') : String(strings);
    assert.match(statement, /to_regclass/);

    return [{
      refresh_runs_exists: true,
      buildings_exists: true,
      instructors_exists: true,
      courses_exists: true,
      course_cross_listings_exists: true,
      packages_exists: true,
      sections_exists: true,
      section_instructors_exists: true,
      meetings_exists: true,
      prerequisite_rules_exists: true,
      prerequisite_nodes_exists: true,
      prerequisite_edges_exists: true,
      prerequisite_course_summaries_exists: true,
      canonical_sections_exists: true,
      canonical_meetings_exists: false,
      schedulable_packages_exists: true,
      course_search_fts_exists: true,
    }];
  };

  assert.equal(await courseBootstrapSchemaNeeded(sql), false);
});

test('courseBootstrapSchemaNeeded returns true when every required course table is missing', async () => {
  const { courseBootstrapSchemaNeeded } = await import(courseImporterPath);
  const sql = async (strings) => {
    const statement = Array.isArray(strings) ? strings.join('') : String(strings);
    assert.match(statement, /to_regclass/);

    return [makeCourseSchemaExistsRow(Object.fromEntries(
      [...expectedCourseImportTables, ...expectedCourseRetainedViews].map((tableName) => [`${tableName}_exists`, false]),
    ))];
  };

  assert.equal(await courseBootstrapSchemaNeeded(sql), true);
});

test('publishCourseDbPostgres rejects when SUPABASE_DATABASE_URL is missing', async () => {
  const { publishCourseDbPostgres } = await import(courseImporterPath);

  await assert.rejects(
    publishCourseDbPostgres({
      env: {},
      sqlFactory() {
        throw new Error('sqlFactory should not be called');
      },
    }),
    /Missing SUPABASE_DATABASE_URL/,
  );
});

test('publishCourseDbPostgres closes the SQL client if SQLite initialization fails', async () => {
  const { publishCourseDbPostgres } = await import(courseImporterPath);
  let endCallCount = 0;

  await assert.rejects(
    publishCourseDbPostgres({
      env: {
        SUPABASE_DATABASE_URL: 'postgres://example.test/db',
      },
      sqlitePath: path.join(repoRoot, 'data', 'does-not-exist.sqlite'),
      sqlFactory() {
        return {
          async end(options) {
            endCallCount += 1;
            assert.deepEqual(options, { timeout: 0 });
          },
        };
      },
    }),
    /unable to open database file/,
  );

  assert.equal(endCallCount, 1);
});

test('publishCourseDbPostgres preserves the original publish failure when sql.end also fails', async () => {
  const { publishCourseDbPostgres } = await import(courseImporterPath);
  const endError = new Error('end failed');

  await assert.rejects(
    publishCourseDbPostgres({
      env: {
        SUPABASE_DATABASE_URL: 'postgres://example.test/db',
      },
      sqlitePath: path.join(repoRoot, 'data', 'does-not-exist.sqlite'),
      sqlFactory() {
        return {
          async end(options) {
            assert.deepEqual(options, { timeout: 0 });
            throw endError;
          },
        };
      },
    }),
    (error) => {
      assert.match(String(error), /unable to open database file/);
      assert.notStrictEqual(error, endError);
      return true;
    },
  );
});

test('publishCourseDbPostgres does not re-apply bootstrap schema when course tables already exist', async () => {
  const { publishCourseDbPostgres } = await import(courseImporterPath);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'postgres-publish-test-'));
  const sqlitePath = path.join(tempDir, 'course.sqlite');
  let bootstrapApplied = false;

  const db = new Database(sqlitePath);

  try {
    for (const tableName of expectedCourseImportTables) {
      if (tableName === 'course_search_fts') {
        db.exec(`CREATE TABLE ${tableName} (
          term_code TEXT,
          course_id TEXT,
          canonical_course_designation TEXT,
          alias_course_designation TEXT,
          alias_course_designation_normalized TEXT,
          alias_course_designation_compact TEXT,
          title TEXT,
          title_normalized TEXT,
          description TEXT
        )`);
        continue;
      }

      db.exec(`CREATE TABLE ${tableName} (id INTEGER)`);
    }
  } finally {
    db.close();
  }

  try {
    await assert.rejects(
      publishCourseDbPostgres({
        env: {
          SUPABASE_DATABASE_URL: 'postgres://example.test/db',
        },
        sqlitePath,
        sqlFactory() {
          return createCourseSchemaStubSql({
            schemaExistsRow: makeCourseSchemaExistsRow(),
            stopMessage: 'stop after schema check',
            onBootstrapApply() {
              bootstrapApplied = true;
            },
          });
        },
      }),
      /stop after schema check/,
    );

    assert.equal(bootstrapApplied, false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('publishCourseDbPostgres applies bootstrap schema when every required course table is missing', async () => {
  const { publishCourseDbPostgres } = await import(courseImporterPath);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'postgres-publish-test-'));
  const sqlitePath = path.join(tempDir, 'course.sqlite');
  let bootstrapApplied = false;

  const db = new Database(sqlitePath);

  try {
    for (const tableName of expectedCourseImportTables) {
      if (tableName === 'course_search_fts') {
        db.exec(`CREATE TABLE ${tableName} (
          term_code TEXT,
          course_id TEXT,
          canonical_course_designation TEXT,
          alias_course_designation TEXT,
          alias_course_designation_normalized TEXT,
          alias_course_designation_compact TEXT,
          title TEXT,
          title_normalized TEXT,
          description TEXT
        )`);
        continue;
      }

      db.exec(`CREATE TABLE ${tableName} (id INTEGER)`);
    }
  } finally {
    db.close();
  }

  try {
    await assert.rejects(
      publishCourseDbPostgres({
        env: {
          SUPABASE_DATABASE_URL: 'postgres://example.test/db',
        },
        sqlitePath,
        sqlFactory() {
          return createCourseSchemaStubSql({
            schemaExistsRow: makeCourseSchemaExistsRow(Object.fromEntries(
              [...expectedCourseImportTables, ...expectedCourseRetainedViews].map((tableName) => [`${tableName}_exists`, false]),
            )),
            stopMessage: 'stop after bootstrap',
            onBootstrapApply() {
              bootstrapApplied = true;
            },
          });
        },
      }),
      /stop after bootstrap/,
    );

    assert.equal(bootstrapApplied, true);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('publishCourseDbPostgres rejects partial-schema targets instead of applying bootstrap schema', async () => {
  const { publishCourseDbPostgres } = await import(courseImporterPath);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'postgres-publish-test-'));
  const sqlitePath = path.join(tempDir, 'course.sqlite');
  let bootstrapApplied = false;

  const db = new Database(sqlitePath);

  try {
    for (const tableName of expectedCourseImportTables) {
      if (tableName === 'course_search_fts') {
        db.exec(`CREATE TABLE ${tableName} (
          term_code TEXT,
          course_id TEXT,
          canonical_course_designation TEXT,
          alias_course_designation TEXT,
          alias_course_designation_normalized TEXT,
          alias_course_designation_compact TEXT,
          title TEXT,
          title_normalized TEXT,
          description TEXT
        )`);
        continue;
      }

      db.exec(`CREATE TABLE ${tableName} (id INTEGER)`);
    }
  } finally {
    db.close();
  }

  try {
    await assert.rejects(
      publishCourseDbPostgres({
        env: {
          SUPABASE_DATABASE_URL: 'postgres://example.test/db',
        },
        sqlitePath,
        sqlFactory() {
          return createCourseSchemaStubSql({
            schemaExistsRow: makeCourseSchemaExistsRow({ refresh_runs_exists: false }),
            stopMessage: 'publish should stop after partial-schema check',
            onBootstrapApply() {
              bootstrapApplied = true;
            },
          });
        },
      }),
      /Refusing to bootstrap partially provisioned course schema/,
    );

    assert.equal(bootstrapApplied, false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('publishCourseDbPostgres rejects targets missing retained course views', async () => {
  const { publishCourseDbPostgres } = await import(courseImporterPath);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'postgres-publish-test-'));
  const sqlitePath = path.join(tempDir, 'course.sqlite');
  let bootstrapApplied = false;

  const db = new Database(sqlitePath);

  try {
    for (const tableName of expectedCourseImportTables) {
      if (tableName === 'course_search_fts') {
        db.exec(`CREATE TABLE ${tableName} (
          term_code TEXT,
          course_id TEXT,
          canonical_course_designation TEXT,
          alias_course_designation TEXT,
          alias_course_designation_normalized TEXT,
          alias_course_designation_compact TEXT,
          title TEXT,
          title_normalized TEXT,
          description TEXT
        )`);
        continue;
      }

      db.exec(`CREATE TABLE ${tableName} (id INTEGER)`);
    }
  } finally {
    db.close();
  }

  try {
    await assert.rejects(
      publishCourseDbPostgres({
        env: {
          SUPABASE_DATABASE_URL: 'postgres://example.test/db',
        },
        sqlitePath,
        sqlFactory() {
          return createCourseSchemaStubSql({
            schemaExistsRow: makeCourseSchemaExistsRow({ course_overview_v_exists: false }),
            stopMessage: 'publish should stop after retained-view check',
            onBootstrapApply() {
              bootstrapApplied = true;
            },
          });
        },
      }),
      /Refusing to bootstrap partially provisioned course schema/,
    );

    assert.equal(bootstrapApplied, false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('publishCourseDbPostgres resets imported identity sequences after swap', async () => {
  const { publishCourseDbPostgres } = await import(courseImporterPath);
  const fixture = await createCourseSqliteFixture({ withRows: true });
  const recorder = createPostgresRecorder({
    schemaExistsRow: makeCourseSchemaExistsRow(),
  });

  try {
    await publishCourseDbPostgres({
      env: {
        SUPABASE_DATABASE_URL: 'postgres://example.test/db',
      },
      sqlitePath: fixture.sqlitePath,
      sqlFactory: recorder.sqlFactory,
    });

    const sequenceSyncIndex = recorder.events.indexOf('sequence-sync:transaction:refresh_runs.refresh_id');
    assert.ok(sequenceSyncIndex > recorder.events.indexOf('swap:public.course_search_fts'));
    assert.ok(sequenceSyncIndex < recorder.events.lastIndexOf('drop:public.schedulable_packages_staging'));
    assert.ok(sequenceSyncIndex < recorder.events.indexOf('end'));
  } finally {
    await fixture.cleanup();
  }
});

test('publishCourseDbPostgres rejects invalid sqliteBatchSize values', async () => {
  const { publishCourseDbPostgres } = await import(courseImporterPath);

  await assert.rejects(
    publishCourseDbPostgres({
      env: {
        SUPABASE_DATABASE_URL: 'postgres://example.test/db',
      },
      sqliteBatchSize: 0,
      sqlFactory() {
        throw new Error('sqlFactory should not be called');
      },
    }),
    /sqliteBatchSize must be a positive integer/,
  );
});

test('publishCourseDbPostgres splits staging inserts when sqliteBatchSize is smaller than the fixture', async () => {
  const { publishCourseDbPostgres } = await import(courseImporterPath);
  const fixture = await createCourseSqliteFixture({
    rowCountsByTable: {
      refresh_runs: 2,
    },
  });
  const recorder = createPostgresRecorder({
    schemaExistsRow: makeCourseSchemaExistsRow(),
    stageCount: 0,
    stageCountsByTable: {
      refresh_runs: 2,
    },
  });

  try {
    await publishCourseDbPostgres({
      env: {
        SUPABASE_DATABASE_URL: 'postgres://example.test/db',
      },
      sqlitePath: fixture.sqlitePath,
      sqliteBatchSize: 1,
      sqlFactory: recorder.sqlFactory,
    });

    assert.equal(
      recorder.events.filter((event) => event === 'load:public.refresh_runs_staging').length,
      2,
    );
  } finally {
    await fixture.cleanup();
  }
});

test('publishCourseDbPostgres splits course_search_fts staging inserts when sqliteBatchSize is smaller than the fixture', async () => {
  const { publishCourseDbPostgres } = await import(courseImporterPath);
  const fixture = await createCourseSqliteFixture({
    rowCountsByTable: {
      course_search_fts: 2,
    },
  });
  const recorder = createPostgresRecorder({
    schemaExistsRow: makeCourseSchemaExistsRow(),
    stageCount: 0,
    stageCountsByTable: {
      course_search_fts: 2,
    },
  });

  try {
    await publishCourseDbPostgres({
      env: {
        SUPABASE_DATABASE_URL: 'postgres://example.test/db',
      },
      sqlitePath: fixture.sqlitePath,
      sqliteBatchSize: 1,
      sqlFactory: recorder.sqlFactory,
    });

    assert.equal(
      recorder.events.filter((event) => event === 'load:public.course_search_fts_staging').length,
      2,
    );
  } finally {
    await fixture.cleanup();
  }
});

test('publishCourseDbPostgres creates course_search_fts staging with valid SQL before loading FTS rows', async () => {
  const { publishCourseDbPostgres } = await import(courseImporterPath);
  const fixture = await createCourseSqliteFixture({ withRows: true });
  const recorder = createPostgresRecorder({
    schemaExistsRow: makeCourseSchemaExistsRow(),
    rejectTemplateCreateStatements: true,
  });

  try {
    await publishCourseDbPostgres({
      env: {
        SUPABASE_DATABASE_URL: 'postgres://example.test/db',
      },
      sqlitePath: fixture.sqlitePath,
      sqlFactory: recorder.sqlFactory,
    });

    assert.ok(
      recorder.events.indexOf('create:public.course_search_fts_staging') !== -1,
      'expected course_search_fts staging table creation to succeed',
    );
    assert.ok(
      recorder.events.indexOf('create:public.course_search_fts_staging')
        < recorder.events.indexOf('load:public.course_search_fts_staging'),
      'expected course_search_fts staging table to be created before loading FTS rows',
    );
  } finally {
    await fixture.cleanup();
  }
});

test('publishCourseDbPostgres runs the expected happy-path workflow when bootstrapping a missing course schema', async () => {
  const { publishCourseDbPostgres } = await import(courseImporterPath);
  const fixture = await createCourseSqliteFixture({ withRows: true });
  const recorder = createPostgresRecorder({
    schemaExistsRow: makeCourseSchemaExistsRow(Object.fromEntries(
      [...expectedCourseImportTables, ...expectedCourseRetainedViews].map((tableName) => [`${tableName}_exists`, false]),
    )),
  });

  try {
    await publishCourseDbPostgres({
      env: {
        SUPABASE_DATABASE_URL: 'postgres://example.test/db',
      },
      sqlitePath: fixture.sqlitePath,
      sqlFactory: recorder.sqlFactory,
    });

    assert.deepEqual(recorder.events.slice(0, 2), ['bootstrap-check', 'bootstrap-apply']);
    const createIndexes = expectedCourseImportTables.map((tableName) => recorder.events.indexOf(`create:public.${tableName}_staging`));
    const loadIndexes = expectedCourseImportTables.map((tableName) => recorder.events.indexOf(
      tableName === 'course_search_fts'
        ? 'load:public.course_search_fts_staging'
        : `load:public.${tableName}_staging`,
    ));
    const validateIndexes = expectedCourseImportTables.map((tableName) => recorder.events.indexOf(`validate:${tableName}`));
    const swapIndexes = expectedCourseImportTables.map((tableName) => recorder.events.indexOf(`swap:public.${tableName}`));
    const lastCreateIndex = Math.max(...createIndexes);
    const lastLoadIndex = Math.max(...loadIndexes);

    assert.ok(createIndexes.every((index) => index > recorder.events.indexOf('bootstrap-apply')));
    assert.deepEqual(createIndexes, [...createIndexes].sort((left, right) => left - right));
    assert.ok(loadIndexes.every((index) => index !== -1));
    assert.deepEqual(loadIndexes, [...loadIndexes].sort((left, right) => left - right));
    assert.ok(validateIndexes.every((index) => index !== -1));
    assert.deepEqual(validateIndexes, [...validateIndexes].sort((left, right) => left - right));
    assert.ok(recorder.events.indexOf('swap-begin') > validateIndexes.at(-1));
    assert.ok(recorder.events.indexOf('swap-truncate') > recorder.events.indexOf('swap-begin'));
    assert.ok(swapIndexes.every((index) => index > recorder.events.indexOf('swap-truncate')));
    assert.deepEqual(swapIndexes, [...swapIndexes].sort((left, right) => left - right));
    const finalCleanupIndex = recorder.events.lastIndexOf('drop:public.schedulable_packages_staging');
    assert.ok(finalCleanupIndex > swapIndexes.at(-1));
    assert.ok(finalCleanupIndex < recorder.events.indexOf('end'));
    assert.ok(recorder.events.at(-1) === 'end');
  } finally {
    await fixture.cleanup();
  }
});

test('publishCourseDbPostgres attempts staging cleanup after swap failure and preserves the original error', async () => {
  const { publishCourseDbPostgres } = await import(courseImporterPath);
  const fixture = await createCourseSqliteFixture({ withRows: true });
  const swapError = new Error('swap failed');
  const cleanupError = new Error('cleanup failed');
  const recorder = createPostgresRecorder({
    schemaExistsRow: makeCourseSchemaExistsRow(),
    swapError,
    cleanupError,
  });

  try {
    await assert.rejects(
      publishCourseDbPostgres({
        env: {
          SUPABASE_DATABASE_URL: 'postgres://example.test/db',
        },
        sqlitePath: fixture.sqlitePath,
        sqlFactory: recorder.sqlFactory,
      }),
      (error) => {
        assert.strictEqual(error, swapError);
        return true;
      },
    );

    assert.equal(
      recorder.events.filter((event) => event === 'drop:public.schedulable_packages_staging').length,
      2,
    );
    assert.equal(recorder.events.at(-1), 'end');
  } finally {
    await fixture.cleanup();
  }
});

test('publish-madgrades-db-postgres exposes the Madgrades import order and requires SUPABASE_DATABASE_URL', async () => {
  const { MADGRADES_IMPORT_TABLES, publishMadgradesDbPostgres } = await import(madgradesImporterPath);

  assert.deepEqual(MADGRADES_IMPORT_TABLES, expectedMadgradesImportTables);
  await assert.rejects(
    publishMadgradesDbPostgres({
      env: {},
      sqlFactory() {
        throw new Error('should not connect');
      },
    }),
    /Missing SUPABASE_DATABASE_URL/,
  );
});

test('publishMadgradesDbPostgres wraps bootstrap schema application in a transaction so failures rollback cleanly', async () => {
  const { publishMadgradesDbPostgres } = await import(madgradesImporterPath);
  const fixture = await createMadgradesSqliteFixture();
  const bootstrapError = new Error('bootstrap failed');
  const recorder = createMadgradesPostgresRecorder({ bootstrapError });

  try {
    await assert.rejects(
      publishMadgradesDbPostgres({
        env: {
          SUPABASE_DATABASE_URL: 'postgres://example.test/db',
        },
        sqlitePath: fixture.sqlitePath,
        sqlFactory: recorder.sqlFactory,
      }),
      (error) => {
        assert.strictEqual(error, bootstrapError);
        return true;
      },
    );

    assert.deepEqual(recorder.events.slice(0, 2), ['bootstrap-check', 'bootstrap-begin']);
    assert.ok(!recorder.events.includes('bootstrap-apply'));
    assert.equal(
      recorder.events.filter((event) => event === 'drop:madgrades.madgrades_instructor_matches_staging').length,
      1,
    );
    assert.equal(recorder.events.at(-1), 'end');
  } finally {
    await fixture.cleanup();
  }
});

test('publishMadgradesDbPostgres does not re-apply bootstrap schema when all required madgrades tables already exist', async () => {
  const { publishMadgradesDbPostgres } = await import(madgradesImporterPath);
  const fixture = await createMadgradesSqliteFixture();
  let bootstrapApplied = false;

  try {
    await assert.rejects(
      publishMadgradesDbPostgres({
        env: {
          SUPABASE_DATABASE_URL: 'postgres://example.test/db',
        },
        sqlitePath: fixture.sqlitePath,
        sqlFactory() {
          const sql = async (strings) => {
            const statement = strings.join('');

            if (statement.includes('to_regclass')) {
              return [makeMadgradesSchemaExistsRow()];
            }

            throw new Error('stop after schema check');
          };

          sql.unsafe = (query) => {
            if (query.includes('to_regclass')) {
              return Promise.resolve([makeMadgradesSchemaExistsRow()]);
            }

            return {
              async simple() {
                bootstrapApplied = true;
              },
            };
          };
          sql.begin = async () => {
            throw new Error('sql.begin should not be called in this test');
          };
          sql.end = async () => {};
          return sql;
        },
      }),
      /stop after schema check/,
    );

    assert.equal(bootstrapApplied, false);
  } finally {
    await fixture.cleanup();
  }
});

test('publishMadgradesDbPostgres applies bootstrap schema when all required madgrades tables are missing', async () => {
  const { publishMadgradesDbPostgres } = await import(madgradesImporterPath);
  const fixture = await createMadgradesSqliteFixture();
  let bootstrapApplied = false;

  try {
    await assert.rejects(
      publishMadgradesDbPostgres({
        env: {
          SUPABASE_DATABASE_URL: 'postgres://example.test/db',
        },
        sqlitePath: fixture.sqlitePath,
        sqlFactory() {
          const missingSchemaRow = makeMadgradesSchemaExistsRow(Object.fromEntries(
            [...expectedMadgradesImportTables, ...expectedMadgradesRequiredIndexes].map((tableName) => [`${tableName}_exists`, false]),
          ));
          const sql = async (strings) => {
            const statement = strings.join('');

            if (statement.includes('to_regclass')) {
              return [missingSchemaRow];
            }

            throw new Error('stop after bootstrap');
          };

          sql.unsafe = (query) => {
            if (query.includes('to_regclass')) {
              return Promise.resolve([missingSchemaRow]);
            }

            return {
              async simple() {
                bootstrapApplied = true;
              },
            };
          };
          sql.begin = async (callback) => callback(sql);
          sql.end = async () => {};
          return sql;
        },
      }),
      /stop after bootstrap/,
    );

    assert.equal(bootstrapApplied, true);
  } finally {
    await fixture.cleanup();
  }
});

test('publishMadgradesDbPostgres rejects partial-schema targets instead of destructively bootstrapping', async () => {
  const { publishMadgradesDbPostgres } = await import(madgradesImporterPath);
  const fixture = await createMadgradesSqliteFixture();
  let bootstrapApplied = false;

  try {
    await assert.rejects(
      publishMadgradesDbPostgres({
        env: {
          SUPABASE_DATABASE_URL: 'postgres://example.test/db',
        },
        sqlitePath: fixture.sqlitePath,
        sqlFactory() {
          const sql = async (strings) => {
            const statement = strings.join('');

            if (statement.includes('to_regclass')) {
              return [makeMadgradesSchemaExistsRow({ madgrades_refresh_runs_exists: false })];
            }

            throw new Error('publish should stop after partial-schema check');
          };

          sql.unsafe = (query) => {
            if (query.includes('to_regclass')) {
              return Promise.resolve([makeMadgradesSchemaExistsRow({ madgrades_refresh_runs_exists: false })]);
            }

            return {
              async simple() {
                bootstrapApplied = true;
              },
            };
          };
          sql.begin = async () => {
            throw new Error('sql.begin should not be called in this test');
          };
          sql.end = async () => {};
          return sql;
        },
      }),
      /Refusing to bootstrap partially provisioned madgrades schema/,
    );

    assert.equal(bootstrapApplied, false);
  } finally {
    await fixture.cleanup();
  }
});

test('publishMadgradesDbPostgres rejects targets missing required madgrades indexes', async () => {
  const { publishMadgradesDbPostgres } = await import(madgradesImporterPath);
  const fixture = await createMadgradesSqliteFixture();
  let bootstrapApplied = false;

  try {
    await assert.rejects(
      publishMadgradesDbPostgres({
        env: {
          SUPABASE_DATABASE_URL: 'postgres://example.test/db',
        },
        sqlitePath: fixture.sqlitePath,
        sqlFactory() {
          const sql = async (strings) => {
            const statement = strings.join('');

            if (statement.includes('to_regclass')) {
              return [makeMadgradesSchemaExistsRow({ idx_madgrades_course_names_course_exists: false })];
            }

            throw new Error('publish should stop after missing-index check');
          };

          sql.unsafe = (query) => {
            if (query.includes('to_regclass')) {
              return Promise.resolve([
                makeMadgradesSchemaExistsRow({ idx_madgrades_course_names_course_exists: false }),
              ]);
            }

            return {
              async simple() {
                bootstrapApplied = true;
              },
            };
          };
          sql.begin = async () => {
            throw new Error('sql.begin should not be called in this test');
          };
          sql.end = async () => {};
          return sql;
        },
      }),
      /Refusing to bootstrap partially provisioned madgrades schema/,
    );

    assert.equal(bootstrapApplied, false);
  } finally {
    await fixture.cleanup();
  }
});

test('publishMadgradesDbPostgres resets imported identity sequences after swap', async () => {
  const { publishMadgradesDbPostgres } = await import(madgradesImporterPath);
  const fixture = await createMadgradesSqliteFixture({ withRows: true });
  const recorder = createMadgradesPostgresRecorder();

  try {
    await publishMadgradesDbPostgres({
      env: {
        SUPABASE_DATABASE_URL: 'postgres://example.test/db',
      },
      sqlitePath: fixture.sqlitePath,
      sqlFactory: recorder.sqlFactory,
    });

    const sequenceSyncEvents = recorder.events.filter((event) => event.startsWith('sequence-sync:'));
    assert.deepEqual(sequenceSyncEvents, expectedMadgradesSequenceSyncEvents);

    const sequenceSyncIndex = recorder.events.indexOf(expectedMadgradesSequenceSyncEvents[0]);
    assert.ok(sequenceSyncIndex > recorder.events.indexOf('swap:madgrades.madgrades_instructor_matches'));
    assert.ok(
      recorder.events.indexOf(expectedMadgradesSequenceSyncEvents.at(-1)) <
        recorder.events.lastIndexOf('drop:madgrades.madgrades_instructor_matches_staging'),
    );
    assert.ok(sequenceSyncIndex < recorder.events.indexOf('end'));
  } finally {
    await fixture.cleanup();
  }
});

test('publishMadgradesDbPostgres rejects invalid sqliteBatchSize values', async () => {
  const { publishMadgradesDbPostgres } = await import(madgradesImporterPath);

  await assert.rejects(
    publishMadgradesDbPostgres({
      env: {
        SUPABASE_DATABASE_URL: 'postgres://example.test/db',
      },
      sqliteBatchSize: Number.NaN,
      sqlFactory() {
        throw new Error('sqlFactory should not be called');
      },
    }),
    /sqliteBatchSize must be a positive integer/,
  );
});

test('publishMadgradesDbPostgres splits staging inserts when sqliteBatchSize is smaller than the fixture', async () => {
  const { publishMadgradesDbPostgres } = await import(madgradesImporterPath);
  const fixture = await createMadgradesSqliteFixture({
    rowCountsByTable: {
      madgrades_refresh_runs: 2,
    },
  });
  const recorder = createMadgradesPostgresRecorder({
    stageCount: 0,
    stageCountsByTable: {
      madgrades_refresh_runs: 2,
    },
  });

  try {
    await publishMadgradesDbPostgres({
      env: {
        SUPABASE_DATABASE_URL: 'postgres://example.test/db',
      },
      sqlitePath: fixture.sqlitePath,
      sqliteBatchSize: 1,
      sqlFactory: recorder.sqlFactory,
    });

    assert.equal(
      recorder.events.filter((event) => event === 'load:madgrades.madgrades_refresh_runs_staging').length,
      2,
    );
  } finally {
    await fixture.cleanup();
  }
});

test('course postgres script main path reads SQLITE_BATCH_SIZE override from env', async () => {
  const originalArgv1 = process.argv[1];

  try {
    process.argv[1] = courseImporterPath;
    process.env.SUPABASE_DATABASE_URL = 'postgres://example.test/db';
    process.env.SQLITE_BATCH_SIZE = '0';

    await assert.rejects(
      import(`${pathToFileURL(courseImporterPath).href}?entrypoint-test=${Date.now()}`),
      /sqliteBatchSize must be a positive integer/,
    );
  } finally {
    process.argv[1] = originalArgv1;
    delete process.env.SUPABASE_DATABASE_URL;
    delete process.env.SQLITE_BATCH_SIZE;
  }
});

test('madgrades postgres script main path reads SQLITE_BATCH_SIZE override from env', async () => {
  const originalArgv1 = process.argv[1];

  try {
    process.argv[1] = madgradesImporterPath;
    process.env.SUPABASE_DATABASE_URL = 'postgres://example.test/db';
    process.env.SQLITE_BATCH_SIZE = '0';

    await assert.rejects(
      import(`${pathToFileURL(madgradesImporterPath).href}?entrypoint-test=${Date.now()}`),
      /sqliteBatchSize must be a positive integer/,
    );
  } finally {
    process.argv[1] = originalArgv1;
    delete process.env.SUPABASE_DATABASE_URL;
    delete process.env.SQLITE_BATCH_SIZE;
  }
});

test('publishMadgradesDbPostgres runs the expected happy-path workflow for Madgrades tables', async () => {
  const { publishMadgradesDbPostgres } = await import(madgradesImporterPath);
  const fixture = await createMadgradesSqliteFixture({ withRows: true });
  const recorder = createMadgradesPostgresRecorder();

  try {
    await publishMadgradesDbPostgres({
      env: {
        SUPABASE_DATABASE_URL: 'postgres://example.test/db',
      },
      sqlitePath: fixture.sqlitePath,
      sqlFactory: recorder.sqlFactory,
    });

    const createIndexes = expectedMadgradesImportTables.map((tableName) =>
      recorder.events.indexOf(`create:madgrades.${tableName}_staging`),
    );
    const loadIndexes = expectedMadgradesImportTables.map((tableName) =>
      recorder.events.indexOf(`load:madgrades.${tableName}_staging`),
    );
    const validateIndexes = expectedMadgradesImportTables.map((tableName) =>
      recorder.events.indexOf(`validate:${tableName}`),
    );
    const swapIndexes = expectedMadgradesImportTables.map((tableName) =>
      recorder.events.indexOf(`swap:madgrades.${tableName}`),
    );

    assert.deepEqual(recorder.events.slice(0, 3), ['bootstrap-check', 'bootstrap-begin', 'bootstrap-apply']);
    assert.deepEqual(
      recorder.events.slice(3, expectedMadgradesImportTables.length + 3),
      [...expectedMadgradesImportTables]
        .reverse()
        .map((tableName) => `drop:madgrades.${tableName}_staging`),
    );
    assert.deepEqual(createIndexes, [...createIndexes].sort((left, right) => left - right));
    assert.deepEqual(loadIndexes, [...loadIndexes].sort((left, right) => left - right));
    assert.deepEqual(validateIndexes, [...validateIndexes].sort((left, right) => left - right));
    assert.ok(recorder.events.indexOf('swap-begin') > validateIndexes.at(-1));
    assert.ok(recorder.events.indexOf('swap-truncate') > recorder.events.indexOf('swap-begin'));
    assert.deepEqual(swapIndexes, [...swapIndexes].sort((left, right) => left - right));
    assert.ok(
      recorder.events.lastIndexOf('drop:madgrades.madgrades_instructor_matches_staging') > swapIndexes.at(-1),
    );
    assert.equal(recorder.events.at(-1), 'end');
  } finally {
    await fixture.cleanup();
  }
});

test('publishMadgradesDbPostgres attempts staging cleanup after swap failure and preserves the original error', async () => {
  const { publishMadgradesDbPostgres } = await import(madgradesImporterPath);
  const fixture = await createMadgradesSqliteFixture({ withRows: true });
  const swapError = new Error('swap failed');
  const cleanupError = new Error('cleanup failed');
  const recorder = createMadgradesPostgresRecorder({ swapError, cleanupError });

  try {
    await assert.rejects(
      publishMadgradesDbPostgres({
        env: {
          SUPABASE_DATABASE_URL: 'postgres://example.test/db',
        },
        sqlitePath: fixture.sqlitePath,
        sqlFactory: recorder.sqlFactory,
      }),
      (error) => {
        assert.strictEqual(error, swapError);
        return true;
      },
    );

    assert.equal(
      recorder.events.filter((event) => event === 'drop:madgrades.madgrades_instructor_matches_staging').length,
      2,
    );
    assert.equal(recorder.events.at(-1), 'end');
  } finally {
    await fixture.cleanup();
  }
});
