#!/usr/bin/env node
/**
 * Seeds the R2 bucket with the objects the Worker reads.
 *
 * The Worker copes with an empty bucket -- the configuration falls back to the
 * committed placeholder and the indexes to empty arrays -- so this script is a
 * convenience, not a prerequisite. Its real purpose is the one-off migration of
 * the memorial's details out of the GitHub Actions variables and into R2, where
 * an administrator can edit them.
 *
 *   node scripts/seed-r2.mjs --dry-run     show what would be written
 *   node scripts/seed-r2.mjs               write anything that is missing
 *   node scripts/seed-r2.mjs --force       overwrite what is already there
 *   node scripts/seed-r2.mjs --local       target the local (wrangler dev) bucket
 *
 * Existing objects are never overwritten without --force: site.json is what the
 * administrator edits, and re-running a seed script should not quietly undo
 * their work.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

const BUCKET = 'rogsplace';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const force = args.has('--force');
const remote = args.has('--local') ? [] : ['--remote'];

const placeholder = JSON.parse(readFileSync(new URL('../src/data/site.json', import.meta.url)));

/** Ignores an unset, empty or whitespace-only variable, exactly as the browser does. */
function fromEnv(name) {
  const value = process.env[name]?.trim();
  return value === undefined || value === '' ? undefined : value;
}

const siteConfig = {
  ...placeholder,
  ...Object.fromEntries(
    Object.entries({
      title: fromEnv('SITE_TITLE'),
      name: fromEnv('SITE_NAME'),
      dateOfBirth: fromEnv('SITE_DATE_OF_BIRTH'),
      dateOfDeath: fromEnv('SITE_DATE_OF_DEATH'),
      welcomeText: fromEnv('SITE_WELCOME_TEXT'),
      mainPhoto: fromEnv('SITE_MAIN_PHOTO'),
    }).filter(([, value]) => value !== undefined),
  ),
};

const objects = [
  { key: 'configuration/site.json', body: siteConfig },
  { key: 'index/memories.json', body: [] },
  { key: 'index/photos.json', body: [] },
];

function wrangler(commandArgs, { allowFailure = false } = {}) {
  try {
    return execFileSync('npx', ['wrangler', ...commandArgs], { encoding: 'utf8', stdio: 'pipe' });
  } catch (error) {
    if (allowFailure) return null;
    process.stderr.write(error.stdout ?? '');
    process.stderr.write(error.stderr ?? '');
    throw error;
  }
}

function exists(key) {
  const result = wrangler(['r2', 'object', 'get', `${BUCKET}/${key}`, ...remote, '--pipe'], {
    allowFailure: true,
  });
  return result !== null;
}

const scratch = mkdtempSync(join(tmpdir(), 'rogsplace-seed-'));

for (const { key, body } of objects) {
  const contents = `${JSON.stringify(body, null, 2)}\n`;

  if (dryRun) {
    console.log(`would write ${key}:\n${contents}`);
    continue;
  }

  if (!force && exists(key)) {
    console.log(`skipped ${key} (already present -- pass --force to overwrite)`);
    continue;
  }

  const file = join(scratch, key.replaceAll('/', '_'));
  writeFileSync(file, contents);
  wrangler([
    'r2',
    'object',
    'put',
    `${BUCKET}/${key}`,
    '--file',
    file,
    '--content-type',
    'application/json',
    ...remote,
  ]);
  console.log(`wrote ${key}`);
}

if (dryRun) console.log('dry run: nothing was written.');
