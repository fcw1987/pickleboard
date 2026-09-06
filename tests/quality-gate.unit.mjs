import test from 'node:test';
import assert from 'node:assert/strict';

import { assertQualityGate, qualityGateFailures } from '../tools/check-quality-gate.mjs';

const success = () => ({ result: 'success' });
const successfulNeeds = () => ({
  checks: success(),
  chromium: success(),
  webkit: success(),
  package: success(),
});

test('quality gate accepts only when every required conclusion is success', () => {
  assert.deepEqual(qualityGateFailures(successfulNeeds()), []);
  assert.doesNotThrow(() => assertQualityGate(successfulNeeds()));
});

for (const conclusion of ['skipped', 'cancelled', 'failure']) {
  test(`quality gate rejects an actual ${conclusion} conclusion`, () => {
    const needs = successfulNeeds();
    needs.webkit = { result: conclusion };
    assert.deepEqual(qualityGateFailures(needs), [`webkit: ${conclusion}`]);
    assert.throws(() => assertQualityGate(needs), new RegExp(`webkit: ${conclusion}`));
  });
}

test('quality gate rejects a missing required job', () => {
  const needs = successfulNeeds();
  delete needs.package;
  assert.deepEqual(qualityGateFailures(needs), ['package: missing']);
  assert.throws(() => assertQualityGate(needs), /package: missing/);
});

test('quality gate reports every non-success conclusion together', () => {
  assert.deepEqual(
    qualityGateFailures({ checks: success(), chromium: { result: 'failure' } }),
    ['chromium: failure', 'webkit: missing', 'package: missing'],
  );
});
