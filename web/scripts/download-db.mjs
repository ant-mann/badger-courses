import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const targetPath = path.join(webRoot, 'data', 'fall-2026.sqlite');

function resolveFromWebRoot(value) {
  return path.isAbsolute(value) ? value : path.resolve(webRoot, value);
}

async function downloadToFile(url, filePath) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download database: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(filePath, buffer);
}

async function main() {
  const localSourcePath = process.env.MADGRADES_DB_SOURCE_PATH;
  const remoteSourceUrl = process.env.MADGRADES_DB_URL;

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });

  if (localSourcePath) {
    const resolvedSourcePath = resolveFromWebRoot(localSourcePath);

    if (!fs.existsSync(resolvedSourcePath)) {
      throw new Error(`Database source path does not exist: ${resolvedSourcePath}`);
    }

    if (resolvedSourcePath !== targetPath) {
      fs.copyFileSync(resolvedSourcePath, targetPath);
    }

    return;
  }

  if (remoteSourceUrl) {
    await downloadToFile(remoteSourceUrl, targetPath);
    return;
  }

  if (fs.existsSync(targetPath)) {
    return;
  }

  throw new Error(
    'No database source configured. Set MADGRADES_DB_SOURCE_PATH or MADGRADES_DB_URL, or provide web/data/fall-2026.sqlite.',
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
