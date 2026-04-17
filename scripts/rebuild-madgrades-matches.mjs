import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { rebuildMadgradesMatches } from '../src/madgrades/rebuild-match-tables.mjs';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');

function readFlagValue(args, flagName) {
  const index = args.indexOf(flagName);
  if (index === -1) {
    return null;
  }

  const value = args[index + 1] ?? null;
  if (value == null || value.startsWith('--')) {
    throw new Error(`Missing value for ${flagName}`);
  }

  return value;
}

const args = process.argv.slice(2);
const result = await rebuildMadgradesMatches({
  courseDbPath: readFlagValue(args, '--course-db') ?? path.join(repoRoot, 'data', 'fall-2026.sqlite'),
  madgradesDbPath: readFlagValue(args, '--madgrades-db') ?? path.join(repoRoot, 'data', 'fall-2026-madgrades.sqlite'),
});

process.stdout.write(`${JSON.stringify(result)}\n`);
