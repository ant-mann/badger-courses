import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile, stat } from 'node:fs/promises';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function createScriptRelativePath(...segments) {
  return path.join(repoRoot, ...segments);
}

async function runPublishCli(scriptName, env, fixtureSqliteStatements) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'turso-publish-cli-'));
  const scriptsDir = path.join(tempDir, 'scripts');
  const dataDir = path.join(tempDir, 'data');
  const nodeModulesPath = path.join(tempDir, 'node_modules');
  const capturePath = path.join(tempDir, 'capture.json');
  const fixturePath = path.join(
    dataDir,
    scriptName === 'publish-course-db.mjs' ? 'fall-2026.sqlite' : 'fall-2026-madgrades.sqlite',
  );
  const sqlite3Path = process.env.SQLITE3_BIN ?? 'sqlite3';

  await mkdir(scriptsDir, { recursive: true });
  await mkdir(dataDir, { recursive: true });
  await copyFile(path.join(repoRoot, 'scripts', 'publish-course-db.mjs'), path.join(scriptsDir, 'publish-course-db.mjs'));
  await copyFile(path.join(repoRoot, 'scripts', 'publish-madgrades-db.mjs'), path.join(scriptsDir, 'publish-madgrades-db.mjs'));
  await symlink(path.join(repoRoot, 'node_modules'), nodeModulesPath, 'dir');

  await execFileAsync(sqlite3Path, [fixturePath, fixtureSqliteStatements]);

  const captureScript = `
import { writeFile } from 'node:fs/promises';

const commands = [];
const scriptName = process.argv[1]?.split('/').pop();

globalThis.__TURSO_PUBLISH_TEST_CAPTURE__ = commands;
globalThis.__TURSO_PUBLISH_TEST_FLUSH__ = async () => {
  await writeFile(process.env.TURSO_PUBLISH_CAPTURE_PATH, JSON.stringify(commands, null, 2));
};
globalThis.__TURSO_PUBLISH_TEST_MOCK__ = async ({ command, args }) => {
  if (command === 'turso' && args[0] === 'db' && args[1] === 'list') {
    return {
      stdout: scriptName === 'publish-course-db.mjs'
        ? 'NAME        GROUP    URL\\ncourse-db   default  libsql://course-db.turso.io\\n'
        : 'NAME           GROUP    URL\\nmadgrades-db   default  libsql://madgrades-db.turso.io\\n',
    };
  }

  if (command === 'turso' && args[0] === 'db' && args[1] === 'shell' && args.length === 4) {
    return { stdout: '' };
  }

  if (command === 'turso' && args[0] === 'db' && args[1] === 'shell') {
    return { stdout: '' };
  }

  return undefined;
};
`;

  await writeFile(path.join(tempDir, 'capture-hook.mjs'), captureScript);

  try {
    await execFileAsync(
      process.execPath,
      ['--import', path.join(tempDir, 'capture-hook.mjs'), path.join(scriptsDir, scriptName)],
      {
        cwd: tempDir,
        env: {
          ...process.env,
          ...env,
          TURSO_PUBLISH_CAPTURE_PATH: capturePath,
          TURSO_PUBLISH_TEST_MODE: '1',
        },
      },
    );

    return JSON.parse(await readFile(capturePath, 'utf8'));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

test('publishCourseDb uses course env vars and default artifact path', async () => {
  const calls = [];
  const { publishCourseDb } = await import('../scripts/publish-course-db.mjs');

  await publishCourseDb({
    env: {
      TURSO_COURSE_DATABASE_URL: 'libsql://course-db.turso.io',
      TURSO_COURSE_AUTH_TOKEN: 'course-token',
    },
    publishImpl: async (options) => {
      calls.push(options);
    },
  });

  assert.deepEqual(calls, [
    {
      databaseUrl: 'libsql://course-db.turso.io',
      dbPath: createScriptRelativePath('data', 'fall-2026.sqlite'),
    },
  ]);
});

test('publishMadgradesDb uses madgrades env vars and default artifact path', async () => {
  const calls = [];
  const { publishMadgradesDb } = await import('../scripts/publish-madgrades-db.mjs');

  await publishMadgradesDb({
    env: {
      TURSO_MADGRADES_DATABASE_URL: 'libsql://madgrades-db.turso.io',
      TURSO_MADGRADES_AUTH_TOKEN: 'madgrades-token',
    },
    publishImpl: async (options) => {
      calls.push(options);
    },
  });

  assert.deepEqual(calls, [
    {
      databaseUrl: 'libsql://madgrades-db.turso.io',
      dbPath: createScriptRelativePath('data', 'fall-2026-madgrades.sqlite'),
    },
  ]);
});

test('publishCourseDb rejects when course env vars are missing before refresh', async () => {
  let publishCalls = 0;
  const { publishCourseDb } = await import('../scripts/publish-course-db.mjs');

  await assert.rejects(
    publishCourseDb({
      env: {
        TURSO_COURSE_AUTH_TOKEN: 'course-token',
      },
      publishImpl: async () => {
        publishCalls += 1;
      },
    }),
    /Missing TURSO_COURSE_DATABASE_URL/,
  );

  assert.equal(publishCalls, 0);
});

test('publishMadgradesDb rejects when madgrades env vars are missing before refresh', async () => {
  let publishCalls = 0;
  const { publishMadgradesDb } = await import('../scripts/publish-madgrades-db.mjs');

  await assert.rejects(
    publishMadgradesDb({
      env: {
        TURSO_MADGRADES_AUTH_TOKEN: 'madgrades-token',
      },
      publishImpl: async () => {
        publishCalls += 1;
      },
    }),
    /Missing TURSO_MADGRADES_DATABASE_URL/,
  );

  assert.equal(publishCalls, 0);
});

test('publishCourseDb does not require a course auth token for CLI refresh', async () => {
  const calls = [];
  const { publishCourseDb } = await import('../scripts/publish-course-db.mjs');

  await publishCourseDb({
    env: {
      TURSO_COURSE_DATABASE_URL: 'libsql://course-db.turso.io',
    },
    publishImpl: async (options) => {
      calls.push(options);
    },
  });

  assert.deepEqual(calls, [
    {
      databaseUrl: 'libsql://course-db.turso.io',
      dbPath: createScriptRelativePath('data', 'fall-2026.sqlite'),
    },
  ]);
});

test('publishMadgradesDb does not require a madgrades auth token for CLI refresh', async () => {
  const calls = [];
  const { publishMadgradesDb } = await import('../scripts/publish-madgrades-db.mjs');

  await publishMadgradesDb({
    env: {
      TURSO_MADGRADES_DATABASE_URL: 'libsql://madgrades-db.turso.io',
    },
    publishImpl: async (options) => {
      calls.push(options);
    },
  });

  assert.deepEqual(calls, [
    {
      databaseUrl: 'libsql://madgrades-db.turso.io',
      dbPath: createScriptRelativePath('data', 'fall-2026-madgrades.sqlite'),
    },
  ]);
});

test('resolveDatabaseName finds the configured database by URL', async () => {
  const { resolveDatabaseName } = await import('../scripts/publish-course-db.mjs');

  const databaseName = await resolveDatabaseName({
    databaseUrl: 'libsql://course-db.turso.io',
    runCommand: async (command, args) => {
      assert.equal(command, 'turso');
      assert.deepEqual(args, ['db', 'list']);
      return {
        stdout: 'NAME        GROUP    URL\ncourse-db   default  libsql://course-db.turso.io\n',
      };
    },
  });

  assert.equal(databaseName, 'course-db');
});

test('resolveDatabaseName rejects when the configured URL is missing from turso db list', async () => {
  const { resolveDatabaseName } = await import('../scripts/publish-course-db.mjs');

  await assert.rejects(
    resolveDatabaseName({
      databaseUrl: 'libsql://missing-db.turso.io',
      runCommand: async () => ({
        stdout: 'NAME        GROUP    URL\ncourse-db   default  libsql://course-db.turso.io\n',
      }),
    }),
    /Could not find a Turso database matching libsql:\/\/missing-db.turso.io/,
  );
});

test('publishSqliteToTurso refreshes the existing database through turso shell', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'turso-publish-'));

  try {
    const dbPath = path.join(tempDir, 'fixture.sqlite');
    await execFileAsync(process.env.SQLITE3_BIN ?? 'sqlite3', [dbPath, "PRAGMA journal_mode=WAL; CREATE TABLE sample(id INTEGER PRIMARY KEY, value TEXT); INSERT INTO sample(value) VALUES('updated');"]);

    const calls = [];
    const { publishSqliteToTurso } = await import('../scripts/publish-course-db.mjs');

    await publishSqliteToTurso({
      databaseUrl: 'libsql://course-db.turso.io',
      authToken: 'secret-token',
      dbPath,
      runCommand: async (command, args, options) => {
        calls.push({ command, args, input: options?.input });

        if (command === 'turso' && args[0] === 'db' && args[1] === 'list') {
          return { stdout: 'NAME        GROUP    URL\ncourse-db   default  libsql://course-db.turso.io\n' };
        }

        if (command === 'turso' && args[0] === 'db' && args[1] === 'shell' && args.length === 4) {
          return { stdout: "TYPE   NAME\ntable  stale_table\n" };
        }

        if (command === 'turso') {
          return { stdout: '' };
        }

        return execFileAsync(command, args, options);
      },
    });

    assert.equal(calls.length, 5);
    assert.deepEqual(calls[0], {
      command: 'turso',
      args: ['db', 'list'],
      input: undefined,
    });
    assert.deepEqual(calls[1].args, [
      'db',
      'shell',
      'course-db',
      "SELECT type, name FROM sqlite_master WHERE type IN ('view', 'table') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'libsql_%' ORDER BY CASE type WHEN 'view' THEN 0 ELSE 1 END, name;",
    ]);
    assert.equal(calls[2].command, 'bash');
    assert.equal(calls[2].args[0], '-lc');
    assert.match(calls[2].args[1], /sqlite3 ".*fixture\.sqlite" ".dump" > ".*dump\.sql"$/);
    assert.deepEqual(calls[3], {
      command: 'turso',
      args: ['db', 'shell', 'course-db'],
      input: 'DROP TABLE IF EXISTS "stale_table";\n',
    });
    assert.equal(calls[4].command, 'turso');
    assert.deepEqual(calls[4].args, ['db', 'shell', 'course-db']);
    assert.match(calls[4].input ?? '', /create table sample/i);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('publishSqliteToTurso drops views before tables when clearing the remote database', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'turso-publish-views-'));

  try {
    const dbPath = path.join(tempDir, 'fixture.sqlite');
    await execFileAsync(process.env.SQLITE3_BIN ?? 'sqlite3', [dbPath, "CREATE TABLE base_table(id INTEGER PRIMARY KEY, value TEXT); CREATE VIEW base_view AS SELECT value FROM base_table;"]);

    const calls = [];
    const { publishSqliteToTurso } = await import('../scripts/publish-course-db.mjs');

    await publishSqliteToTurso({
      databaseUrl: 'libsql://course-db.turso.io',
      authToken: 'secret-token',
      dbPath,
      runCommand: async (command, args, options) => {
        calls.push({ command, args, input: options?.input });

        if (command === 'turso' && args[0] === 'db' && args[1] === 'list') {
          return { stdout: 'NAME        GROUP    URL\ncourse-db   default  libsql://course-db.turso.io\n' };
        }

        if (command === 'turso' && args[0] === 'db' && args[1] === 'shell' && args.length === 4) {
          return { stdout: "TYPE   NAME\nview   stale_view\ntable  stale_table\n" };
        }

        if (command === 'turso') {
          return { stdout: '' };
        }

        return execFileAsync(command, args, options);
      },
    });

    assert.equal(calls[3].input, 'DROP VIEW IF EXISTS "stale_view";\nDROP TABLE IF EXISTS "stale_table";\n');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('publish-course-db CLI refreshes the default course artifact through turso shell', async () => {
  const commands = await runPublishCli(
    'publish-course-db.mjs',
    {
      TURSO_COURSE_DATABASE_URL: 'libsql://course-db.turso.io',
    },
    "CREATE TABLE local_course_data(id INTEGER PRIMARY KEY, value TEXT); INSERT INTO local_course_data(value) VALUES('course');",
  );

  assert.deepEqual(commands[0].args, ['db', 'list']);
  assert.deepEqual(commands[1].args, [
    'db',
    'shell',
    'course-db',
    "SELECT type, name FROM sqlite_master WHERE type IN ('view', 'table') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'libsql_%' ORDER BY CASE type WHEN 'view' THEN 0 ELSE 1 END, name;",
  ]);
  assert.equal(commands[2].args[0], '-lc');
  assert.match(commands[2].args[1], /sqlite3 ".*fall-2026\.sqlite" ".dump" > ".*dump\.sql"$/);
  assert.deepEqual(commands[3].args, ['db', 'shell', 'course-db']);
  assert.match(commands[3].input, /create table local_course_data/i);
});

test('publish-madgrades-db CLI refreshes the default madgrades artifact through turso shell', async () => {
  const commands = await runPublishCli(
    'publish-madgrades-db.mjs',
    {
      TURSO_MADGRADES_DATABASE_URL: 'libsql://madgrades-db.turso.io',
    },
    "CREATE TABLE local_madgrades_data(id INTEGER PRIMARY KEY, value TEXT); INSERT INTO local_madgrades_data(value) VALUES('madgrades');",
  );

  assert.deepEqual(commands[0].args, ['db', 'list']);
  assert.deepEqual(commands[1].args, [
    'db',
    'shell',
    'madgrades-db',
    "SELECT type, name FROM sqlite_master WHERE type IN ('view', 'table') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'libsql_%' ORDER BY CASE type WHEN 'view' THEN 0 ELSE 1 END, name;",
  ]);
  assert.equal(commands[2].args[0], '-lc');
  assert.match(commands[2].args[1], /sqlite3 ".*fall-2026-madgrades\.sqlite" ".dump" > ".*dump\.sql"$/);
  assert.deepEqual(commands[3].args, ['db', 'shell', 'madgrades-db']);
  assert.match(commands[3].input, /create table local_madgrades_data/i);
});

test('dumpSqliteDatabase writes a dump file without buffering stdout', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'turso-publish-dump-file-'));

  try {
    const dbPath = path.join(tempDir, 'fixture.sqlite');
    await execFileAsync(process.env.SQLITE3_BIN ?? 'sqlite3', [dbPath, "CREATE TABLE sample(id INTEGER PRIMARY KEY, value TEXT); INSERT INTO sample(value) VALUES('streamed');"]);

    const calls = [];
    const { dumpSqliteDatabase } = await import('../scripts/publish-course-db.mjs');

    const dumpPath = await dumpSqliteDatabase(dbPath, {
      runCommand: async (command, args, options) => {
        calls.push({ command, args, input: options?.input });

        if (command === 'bash') {
          const dumpFileMatch = args[1].match(/> "([^"]+)"$/);
          assert.ok(dumpFileMatch);
          const dumpOutputPath = dumpFileMatch[1];
          await writeFile(dumpOutputPath, 'CREATE TABLE sample(id INTEGER PRIMARY KEY, value TEXT);\n');
          return { stdout: '' };
        }

        throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
      },
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].command, 'bash');
    assert.equal(calls[0].args[0], '-lc');
    assert.match(calls[0].args[1], /sqlite3 ".*fixture\.sqlite" ".dump" > ".*dump\.sql"$/);

    const dumpStats = await stat(dumpPath);
    assert.ok(dumpStats.size > 0);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
