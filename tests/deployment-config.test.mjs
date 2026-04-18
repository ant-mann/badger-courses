import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, '..');

test('fly deployment config defines the Supabase runtime env var without Turso runtime placeholders', () => {
  const flyToml = fs.readFileSync(path.join(repoRoot, 'web', 'fly.toml'), 'utf8');

  assert.match(flyToml, /^\s*SUPABASE_DATABASE_URL\s*=/m);
  assert.doesNotMatch(flyToml, /TURSO_COURSE_DATABASE_URL\s*=/);
  assert.doesNotMatch(flyToml, /TURSO_MADGRADES_DATABASE_URL\s*=/);
  assert.doesNotMatch(flyToml, /MADGRADES_COURSE_REPLICA_PATH\s*=/);
  assert.doesNotMatch(flyToml, /MADGRADES_MADGRADES_REPLICA_PATH\s*=/);
  assert.doesNotMatch(flyToml, /MADGRADES_DB_SOURCE_PATH\s*=/);
});

test('docker build keeps sqlite only as a build-time input and excludes it from the production runner', () => {
  const dockerfile = fs.readFileSync(path.join(repoRoot, 'web', 'Dockerfile'), 'utf8');
  const stages = dockerfile.split(/^FROM\s+/m).filter(Boolean);
  const runnerStage = stages.at(-1) ?? '';

  assert.match(dockerfile, /COPY\s+data\/fall-2026\.sqlite\s+\.\/data\/fall-2026\.sqlite/);
  assert.match(dockerfile, /ENV\s+MADGRADES_DB_PATH=\/app\/data\/fall-2026\.sqlite/);
  assert.match(dockerfile, /next build/);
  assert.doesNotMatch(runnerStage, /\/app\/data\/fall-2026\.sqlite/);
  assert.doesNotMatch(runnerStage, /COPY\s+--from=[^\s]+\s+\/app\/data/);
  assert.doesNotMatch(runnerStage, /COPY\s+--from=[^\s]+\s+\/app\/web\/data/);
  assert.doesNotMatch(runnerStage, /MADGRADES_DB_PATH/);
});
