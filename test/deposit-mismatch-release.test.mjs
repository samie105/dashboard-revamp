import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('manual verify releases admin reservation on Flutterwave amount or currency mismatch', () => {
  const source = readFileSync('app/api/deposit/verify/route.ts', 'utf8');
  const mismatchBlock = source.slice(
    source.indexOf('if (amountDiff > 1.0 || charge.currency !== deposit.fiatCurrency)'),
    source.indexOf('if (normalizedStatus === "successful")'),
  );

  assert.match(mismatchBlock, /cancelAdminFiatReservation/);
});

test('Flutterwave webhook releases admin reservation on amount or currency mismatch', () => {
  const source = readFileSync('app/api/deposit/webhook/route.ts', 'utf8');
  const mismatchBlock = source.slice(
    source.indexOf('if (amountDiff > 1.0 || charge.currency !== deposit.fiatCurrency)'),
    source.indexOf('if (normalizedStatus === "successful")'),
  );

  assert.match(mismatchBlock, /cancelAdminFiatReservation/);
});
