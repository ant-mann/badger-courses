import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

import { generateSchedules, DEFAULT_LIMIT } from '../src/schedule/engine.mjs';

const __filename = fileURLToPath(import.meta.url);

function parseArgs(argv) {
  const options = {
    db: null,
    courses: [],
    lockPackages: [],
    excludePackages: [],
    limit: DEFAULT_LIMIT,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const flag = argv[index];

    if (flag === '--db' || flag === '--course' || flag === '--lock-package' || flag === '--exclude-package' || flag === '--limit') {
      const value = argv[index + 1];
      if (value == null) {
        throw new Error(`Missing value for ${flag}`);
      }

      if (flag === '--db') {
        options.db = value;
      } else if (flag === '--course') {
        options.courses.push(value);
      } else if (flag === '--lock-package') {
        options.lockPackages.push(value);
      } else if (flag === '--exclude-package') {
        options.excludePackages.push(value);
      } else {
        const parsedLimit = Number.parseInt(value, 10);
        if (!Number.isInteger(parsedLimit) || parsedLimit < 0) {
          throw new Error(`Invalid --limit value: ${value}`);
        }
        options.limit = parsedLimit;
      }

      index += 1;
      continue;
    }

    throw new Error(`Unknown flag: ${flag}`);
  }

  if (!options.db) {
    throw new Error('Missing required --db');
  }

  if (options.courses.length === 0) {
    throw new Error('At least one --course is required');
  }

  return options;
}

function main() {
  const options = parseArgs(process.argv);
  const db = new Database(options.db, { readonly: true });

  try {
    const schedules = generateSchedules(db, options);
    process.stdout.write(`${JSON.stringify({ schedules })}\n`);
  } finally {
    db.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
