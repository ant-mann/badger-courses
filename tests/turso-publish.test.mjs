import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const courseDbPath = path.join(repoRoot, 'data', 'fall-2026.sqlite');
const madgradesDbPath = path.join(repoRoot, 'data', 'fall-2026-madgrades.sqlite');

function createScriptRelativePath(...segments) {
  return path.join(repoRoot, ...segments);
}

async function runPublishCli(scriptName, env, fixtureBytes) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'turso-publish-cli-'));
  const scriptsDir = path.join(tempDir, 'scripts');
  const dataDir = path.join(tempDir, 'data');
  const preloadPath = path.join(tempDir, 'mock-fetch.mjs');
  const capturePath = path.join(tempDir, 'capture.json');
  const fixturePath = path.join(
    dataDir,
    scriptName === 'publish-course-db.mjs' ? 'fall-2026.sqlite' : 'fall-2026-madgrades.sqlite',
  );

  await mkdir(scriptsDir, { recursive: true });
  await mkdir(dataDir, { recursive: true });
  await copyFile(path.join(repoRoot, 'scripts', 'publish-course-db.mjs'), path.join(scriptsDir, 'publish-course-db.mjs'));
  await copyFile(path.join(repoRoot, 'scripts', 'publish-madgrades-db.mjs'), path.join(scriptsDir, 'publish-madgrades-db.mjs'));
  await writeFile(fixturePath, fixtureBytes);

  await writeFile(
    preloadPath,
    `import { Buffer } from 'node:buffer';\nimport { writeFile } from 'node:fs/promises';\nconst capturePath = process.env.TURSO_PUBLISH_CAPTURE_PATH;\nglobalThis.fetch = async (url, init = {}) => {\n  const body = Buffer.from(init.body ?? []);\n  await writeFile(capturePath, JSON.stringify({\n    url,\n    method: init.method ?? 'GET',\n    headers: init.headers ?? {},\n    bodyLength: body.length,\n    bodyBase64: body.toString('base64'),\n  }));\n  return new Response(null, { status: 200, statusText: 'OK' });\n};\n`,
  );

  try {
    await execFileAsync(
      process.execPath,
      ['--import', preloadPath, path.join(scriptsDir, scriptName)],
      {
        cwd: tempDir,
        env: {
          ...process.env,
          ...env,
          TURSO_PUBLISH_CAPTURE_PATH: capturePath,
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
      TURSO_COURSE_DATABASE_URL: 'https://course-db.turso.io/',
      TURSO_COURSE_AUTH_TOKEN: 'course-token',
    },
    publishImpl: async (options) => {
      calls.push(options);
    },
  });

  assert.deepEqual(calls, [
    {
      databaseUrl: 'https://course-db.turso.io/',
      authToken: 'course-token',
      dbPath: createScriptRelativePath('data', 'fall-2026.sqlite'),
    },
  ]);
});

test('publishMadgradesDb uses madgrades env vars and default artifact path', async () => {
  const calls = [];
  const { publishMadgradesDb } = await import('../scripts/publish-madgrades-db.mjs');

  await publishMadgradesDb({
    env: {
      TURSO_MADGRADES_DATABASE_URL: 'https://madgrades-db.turso.io/',
      TURSO_MADGRADES_AUTH_TOKEN: 'madgrades-token',
    },
    publishImpl: async (options) => {
      calls.push(options);
    },
  });

  assert.deepEqual(calls, [
    {
      databaseUrl: 'https://madgrades-db.turso.io/',
      authToken: 'madgrades-token',
      dbPath: createScriptRelativePath('data', 'fall-2026-madgrades.sqlite'),
    },
  ]);
});

test('publishCourseDb rejects when course env vars are missing before upload', async () => {
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

test('publishMadgradesDb rejects when madgrades env vars are missing before upload', async () => {
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

test('publishCourseDb rejects when course auth token is missing before upload', async () => {
  let publishCalls = 0;
  const { publishCourseDb } = await import('../scripts/publish-course-db.mjs');

  await assert.rejects(
    publishCourseDb({
      env: {
        TURSO_COURSE_DATABASE_URL: 'https://course-db.turso.io/',
      },
      publishImpl: async () => {
        publishCalls += 1;
      },
    }),
    /Missing TURSO_COURSE_AUTH_TOKEN/,
  );

  assert.equal(publishCalls, 0);
});

test('publishMadgradesDb rejects when madgrades auth token is missing before upload', async () => {
  let publishCalls = 0;
  const { publishMadgradesDb } = await import('../scripts/publish-madgrades-db.mjs');

  await assert.rejects(
    publishMadgradesDb({
      env: {
        TURSO_MADGRADES_DATABASE_URL: 'https://madgrades-db.turso.io/',
      },
      publishImpl: async () => {
        publishCalls += 1;
      },
    }),
    /Missing TURSO_MADGRADES_AUTH_TOKEN/,
  );

  assert.equal(publishCalls, 0);
});

test('publish-course-db CLI uploads the default course artifact', async () => {
  const sqliteBytes = Buffer.from('course-cli-bytes');
  const capture = await runPublishCli(
    'publish-course-db.mjs',
    {
      TURSO_COURSE_DATABASE_URL: 'libsql://course-db.turso.io',
      TURSO_COURSE_AUTH_TOKEN: 'course-token',
    },
    sqliteBytes,
  );

  assert.equal(capture.url, 'https://course-db.turso.io/v1/upload');
  assert.equal(capture.method, 'POST');
  assert.equal(capture.headers.Authorization, 'Bearer course-token');
  assert.equal(capture.headers['Content-Length'], String(sqliteBytes.length));
  assert.equal(capture.bodyBase64, sqliteBytes.toString('base64'));
});

test('publish-madgrades-db CLI uploads the default madgrades artifact', async () => {
  const sqliteBytes = Buffer.from('madgrades-cli-bytes');
  const capture = await runPublishCli(
    'publish-madgrades-db.mjs',
    {
      TURSO_MADGRADES_DATABASE_URL: 'libsql://madgrades-db.turso.io',
      TURSO_MADGRADES_AUTH_TOKEN: 'madgrades-token',
    },
    sqliteBytes,
  );
  const fixtureStats = await stat(madgradesDbPath);

  assert.equal(capture.url, 'https://madgrades-db.turso.io/v1/upload');
  assert.equal(capture.method, 'POST');
  assert.equal(capture.headers.Authorization, 'Bearer madgrades-token');
  assert.equal(capture.headers['Content-Length'], String(sqliteBytes.length));
  assert.equal(capture.bodyLength, sqliteBytes.length);
  assert.equal(capture.bodyBase64, sqliteBytes.toString('base64'));
  assert.notEqual(fixtureStats.size, sqliteBytes.length);
});

test('publishSqliteToTurso uploads sqlite bytes with bearer auth and content length', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'turso-publish-'));

  try {
    const dbPath = path.join(tempDir, 'fixture.sqlite');
    const sqliteBytes = Buffer.from([0x53, 0x51, 0x4c, 0x69, 0x74, 0x65]);
    await writeFile(dbPath, sqliteBytes);

    const calls = [];
    const fetchImpl = async (url, init = {}) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        async text() {
          return '';
        },
      };
    };

    const { publishSqliteToTurso } = await import('../scripts/publish-course-db.mjs');

    await publishSqliteToTurso({
      databaseUrl: 'libsql://example.turso.io',
      authToken: 'secret-token',
      dbPath,
      fetchImpl,
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://example.turso.io/v1/upload');
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer secret-token');
    assert.equal(calls[0].init.headers['Content-Length'], String(sqliteBytes.length));
    assert.deepEqual(Buffer.from(calls[0].init.body), sqliteBytes);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('publishSqliteToTurso throws on non-ok upload responses', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'turso-publish-failure-'));

  try {
    const dbPath = path.join(tempDir, 'fixture.sqlite');
    await writeFile(dbPath, Buffer.from('SQLite'));

    const { publishSqliteToTurso } = await import('../scripts/publish-course-db.mjs');

    await assert.rejects(
      publishSqliteToTurso({
        databaseUrl: 'https://example.turso.io',
        authToken: 'secret-token',
        dbPath,
        fetchImpl: async () => ({
          ok: false,
          status: 500,
          statusText: 'Server Error',
          async text() {
            return 'upload failed';
          },
        }),
      }),
      /500 Server Error: upload failed/,
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
