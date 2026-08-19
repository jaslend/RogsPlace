#!/usr/bin/env node
/**
 * Creates or rotates the family invitation link.
 *
 *   node scripts/create-invite.mjs --site https://rogsplace.uk
 *   node scripts/create-invite.mjs --local          target the wrangler dev bucket
 *
 * Only the SHA-256 hash of the token is stored, so the link cannot be recovered
 * from the bucket -- which also means it is printed exactly once, here. If it
 * is lost, run this again and share the new one.
 *
 * Each run raises the stored version, and sessions carry the version they were
 * issued against, so rotating signs out everyone holding the old link. That is
 * the intended way to deal with a link that has been forwarded too widely.
 *
 * Until stage 3 adds the admin interface, this script is how an invitation is
 * issued.
 */

import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * `wrangler dev` binds preview_bucket_name, not bucket_name, so a local run has
 * to target that one or the Worker will not see what this script wrote.
 */
function bucketName(args) {
  const explicit = args.indexOf('--bucket');
  if (explicit !== -1) return (args[explicit + 1] ?? '').trim();
  return args.includes('--local') ? 'rogsplace-preview' : 'rogsplace';
}
const KEY = 'configuration/invite.json';

const argv = process.argv.slice(2);
const BUCKET = bucketName(argv);
const remote = argv.includes('--local') ? [] : ['--remote'];
const siteIndex = argv.indexOf('--site');
const site =
  siteIndex === -1 ? 'https://jaslend.github.io/RogsPlace' : (argv[siteIndex + 1] ?? '').trim();

if (site === '') {
  console.error('--site needs a URL, e.g. --site https://rogsplace.uk');
  process.exit(1);
}

function wrangler(args, { allowFailure = false } = {}) {
  try {
    return execFileSync('npx', ['wrangler', ...args], { encoding: 'utf8', stdio: 'pipe' });
  } catch (error) {
    if (allowFailure) return null;
    process.stderr.write(error.stdout ?? '');
    process.stderr.write(error.stderr ?? '');
    throw error;
  }
}

/** The version of the current invitation, or 0 when there is not one. */
function currentVersion() {
  const existing = wrangler(['r2', 'object', 'get', `${BUCKET}/${KEY}`, ...remote, '--pipe'], {
    allowFailure: true,
  });
  if (existing === null) return 0;

  try {
    return Number(JSON.parse(existing).version) || 0;
  } catch {
    return 0;
  }
}

// 256 bits of randomness: not guessable, and short enough to paste into a message.
const token = randomBytes(32).toString('base64url');
const version = currentVersion() + 1;

const record = {
  tokenHash: createHash('sha256').update(token).digest('hex'),
  version,
  rotatedAt: new Date().toISOString(),
};

const file = join(mkdtempSync(join(tmpdir(), 'rogsplace-invite-')), 'invite.json');
writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);

wrangler([
  'r2',
  'object',
  'put',
  `${BUCKET}/${KEY}`,
  '--file',
  file,
  '--content-type',
  'application/json',
  ...remote,
]);

console.log('');
console.log(`Invitation ${version} created. Share this link with family and friends:`);
console.log('');
console.log(`  ${site.replace(/\/$/, '')}/invite/${token}`);
console.log('');
console.log('It is shown here once and cannot be recovered afterwards.');
if (version > 1) {
  console.log('Anyone using the previous link has been signed out and will need this one.');
}
console.log('');
