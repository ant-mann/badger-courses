import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, '..');

test('fly deployment config defines Turso runtime env vars instead of a build-time sqlite source path', () => {
  const flyToml = fs.readFileSync(path.join(repoRoot, 'web', 'fly.toml'), 'utf8');

  assert.doesNotMatch(flyToml, /\[build\.args\]/);
  assert.doesNotMatch(flyToml, /MADGRADES_DB_SOURCE_PATH\s*=/);
  assert.match(flyToml, /TURSO_COURSE_DATABASE_URL\s*=\s*""/);
  assert.match(flyToml, /TURSO_MADGRADES_DATABASE_URL\s*=\s*""/);
  assert.match(flyToml, /MADGRADES_COURSE_REPLICA_PATH\s*=\s*"\/tmp\/course-replica\.db"/);
  assert.match(flyToml, /MADGRADES_MADGRADES_REPLICA_PATH\s*=\s*"\/tmp\/madgrades-replica\.db"/);
  assert.doesNotMatch(flyToml, /\/data\/course-replica\.db/);
  assert.doesNotMatch(flyToml, /\/data\/madgrades-replica\.db/);
});

test('runner image includes the web workspace dependencies without bundling sqlite data files', () => {
  const dockerfile = fs.readFileSync(path.join(repoRoot, 'web', 'Dockerfile'), 'utf8');
  const webPackageJson = fs.readFileSync(path.join(repoRoot, 'web', 'package.json'), 'utf8');

  assert.match(dockerfile, /CMD \["pnpm", "--filter", "uw-madison-courses-web", "run", "start"\]/);
  assert.match(dockerfile, /COPY --from=base \/app\/web\/node_modules \.\/web\/node_modules/);
  assert.doesNotMatch(dockerfile, /ARG MADGRADES_DB_SOURCE_PATH/);
  assert.doesNotMatch(dockerfile, /ENV MADGRADES_DB_SOURCE_PATH=/);
  assert.doesNotMatch(dockerfile, /download-db\.mjs/);
  assert.doesNotMatch(dockerfile, /COPY --from=base \/app\/web\/data \.\/web\/data/);
  assert.doesNotMatch(webPackageJson, /"prebuild"\s*:\s*"node scripts\/download-db\.mjs"/);
});
