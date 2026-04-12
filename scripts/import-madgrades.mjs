import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { runMadgradesImport } from '../src/madgrades/import-runner.mjs';

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
const refreshApi = args.includes('--refresh-api');
const dbPath = readFlagValue(args, '--db') ?? path.join(repoRoot, 'data', 'fall-2026.sqlite');
const snapshotRoot = readFlagValue(args, '--snapshot-root') ?? path.join(repoRoot, 'data', 'madgrades');

const result = await runMadgradesImport({
  dbPath,
  snapshotRoot,
  refreshApi,
});

process.stdout.write(`${JSON.stringify(result)}\n`);
