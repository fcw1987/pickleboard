// Compare complete generated asset trees before and after deterministic generation.
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const walk = async dir => (await Promise.all((await readdir(dir, { withFileTypes: true })).map(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : `${dir}/${e.name}`))).flat();
const snapshot = async () => Object.fromEntries(await Promise.all([...(await walk('assets')), ...(await walk('icons'))].sort().map(async p => [p, createHash('sha256').update(await readFile(p)).digest('hex')])));
const before = await snapshot();
for (const script of ['generate-replay-art', 'generate-art', 'generate-park-art']) execFileSync(process.execPath, [`tools/${script}.mjs`], { stdio: 'pipe' });
const after = await snapshot();
const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(p => before[p] !== after[p]);
if (changed.length) throw Error(`Generated output is not reproducible: ${changed.join(', ')}`);
console.log(`Reproduced ${Object.keys(before).length} assets exactly, including metadata and source sheets.`);
