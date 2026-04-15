import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, '..');

test('fly deployment config passes a DB source path to the Docker build', () => {
  const flyToml = fs.readFileSync(path.join(repoRoot, 'web', 'fly.toml'), 'utf8');

  assert.match(flyToml, /\[build\.args\]/);
  assert.match(flyToml, /MADGRADES_DB_SOURCE_PATH\s*=\s*"\.\.\/data\/fall-2026\.sqlite"/);
});

test('runner image includes the web workspace dependencies needed by next start', () => {
  const dockerfile = fs.readFileSync(path.join(repoRoot, 'web', 'Dockerfile'), 'utf8');

  assert.match(dockerfile, /CMD \["pnpm", "--filter", "uw-madison-courses-web", "run", "start"\]/);
  assert.match(dockerfile, /COPY --from=base \/app\/web\/node_modules \.\/web\/node_modules/);
});
