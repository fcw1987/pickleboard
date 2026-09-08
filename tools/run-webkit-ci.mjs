import { appendFileSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { enforceWebKitPolicy } from './webkit-policy.mjs';

mkdirSync('release-results', { recursive: true });
const reportPath = 'release-results/webkit-raw.json';
const diagnosticsPath = 'release-results/webkit-infrastructure.json';
const summaryPath = 'release-results/webkit-policy-summary.json';
rmSync(reportPath, { force: true });
rmSync(summaryPath, { force: true });
const run = spawnSync('npx', ['playwright', 'test', '--config=playwright.webkit.config.mjs', '--workers=1', '--reporter=line,json,html'], {
  stdio: 'inherit',
  env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath, PLAYWRIGHT_HTML_OUTPUT_DIR: 'release-results/webkit-html', PLAYWRIGHT_HTML_OPEN: 'never' },
});
if (run.error) throw run.error;
const summary = enforceWebKitPolicy(reportPath, diagnosticsPath, summaryPath);
if (run.status !== 1) throw new Error(`Full WebKit suite must exit 1 before policy acceptance; received ${run.status}`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
  '### WebKit infrastructure policy',
  '',
  `- Original suite result: **${summary.counts.passed} passed, ${summary.counts.allowedFailures} failed**.`,
  '- The 7 failures exactly match the reviewed WebKit infrastructure signatures; no test was skipped or weakened.',
  `- Exception review expires **${summary.reviewExpires}**; tracking issue: https://github.com/fcw1987/pickleboard/issues/14`,
  '',
].join('\n'));
console.log(JSON.stringify(summary));
