import { access, readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
const worker = await readFile('sw.js', 'utf8');
const html = await readFile('index.html', 'utf8');

const paths = new Set([
  'index.html',
  'script.js',
  'styles.css',
  'manifest.json',
  ...manifest.icons.map(icon => icon.src),
  ...[...html.matchAll(/(?:href|src)="([^"#?]+)"/g)].map(match => match[1]),
  ...[...worker.matchAll(/['"]\.\/([^'"]+\.[a-z0-9]+)['"]/gi)].map(match => match[1])
]);

const missing = [];
for (const path of paths) {
  try {
    await access(path);
  } catch {
    missing.push(path);
  }
}

if (missing.length) {
  console.error(`Missing referenced static assets:\n${missing.map(path => `- ${path}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Validated ${paths.size} referenced static assets.`);
}
