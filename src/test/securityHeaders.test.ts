import { describe, expect, it } from 'vitest';
import headers from '../../public/_headers?raw';
import indexHtml from '../../index.html?raw';

/**
 * Guards the Content Security Policy in public/_headers.
 *
 * A CSP is easy to weaken by accident and the weakening is invisible: the site
 * carries on working, which is exactly why nobody notices. These tests pin the
 * properties that would be given away first.
 */

/** The single Content-Security-Policy line, without its directive name. */
const policy = (() => {
  const line = headers
    .split('\n')
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate.startsWith('Content-Security-Policy:'));

  if (line === undefined) throw new Error('public/_headers has no Content-Security-Policy.');

  return line.slice('Content-Security-Policy:'.length).trim();
})();

/** The value of a header line, ignoring the comments around it. */
function headerValue(name: string): string {
  const line = headers
    .split('\n')
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate.startsWith(`${name}:`));

  return line === undefined ? '' : line.slice(name.length + 1).trim();
}

function directive(name: string): string {
  const match = policy.split(';').find((part) => part.trim().startsWith(`${name} `));
  return match === undefined ? '' : match.trim();
}

describe('the Content Security Policy', () => {
  it('applies to every path', () => {
    expect(headers).toContain('/*');
  });

  it.each(["'unsafe-inline'", "'unsafe-eval'"])('does not contain %s', (escapeHatch) => {
    // Either one hands back most of what the policy is for. The build produces
    // external scripts and stylesheets only, so neither is needed.
    expect(policy).not.toContain(escapeHatch);
  });

  it('falls back to same-origin for anything not named', () => {
    expect(directive('default-src')).toBe("default-src 'self'");
  });

  it('allows blob: images, which the upload previews depend on', () => {
    // URL.createObjectURL previews a chosen photograph before it is sent.
    // Without this the preview breaks and nothing explains why.
    expect(directive('img-src')).toContain('blob:');
  });

  it('does not allow blob: or data: to be scripts', () => {
    expect(directive('script-src')).toBe("script-src 'self'");
  });

  it.each([
    ['frame-ancestors', "frame-ancestors 'none'"],
    ['object-src', "object-src 'none'"],
    ['base-uri', "base-uri 'self'"],
    ['form-action', "form-action 'self'"],
  ])('locks down %s', (name, expected) => {
    expect(directive(name)).toBe(expected);
  });
});

describe('the headers alongside it', () => {
  it.each([
    'X-Content-Type-Options: nosniff',
    'Referrer-Policy: strict-origin-when-cross-origin',
    'X-Frame-Options: DENY',
  ])('sets %s', (header) => {
    expect(headers).toContain(header);
  });

  it('sets HSTS without preload, which is a one-way door', () => {
    // Read the header's own value: the comment above it in the file explains
    // why preload is absent, and so contains the word.
    expect(headerValue('Strict-Transport-Security')).toBe(
      'max-age=31536000; includeSubDomains',
    );
  });
});

describe('the page the policy has to allow', () => {
  it('has no inline style attribute, which would need unsafe-inline', () => {
    // The noscript message is styled by .noscript-message in global.css for
    // exactly this reason. One style attribute would force the escape hatch
    // back into style-src for the whole site.
    expect(indexHtml).not.toMatch(/\sstyle="/);
  });

  it('has no inline script', () => {
    expect(indexHtml).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
  });
});
