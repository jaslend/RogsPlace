import { describe, expect, it } from 'vitest';
import { appConfig } from '../config/appConfig';
import { validateSelectedFiles } from './fileValidation';

const { maxFiles, maxBytesPerFile } = appConfig.upload;

function makeFile(name: string, type: string, size = 1024): File {
  const file = new File(['x'], name, { type });
  // File contents are irrelevant here; only the reported size matters.
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('validateSelectedFiles', () => {
  it('accepts JPEG, PNG and WebP photographs', () => {
    const { accepted, rejected } = validateSelectedFiles([
      makeFile('a.jpg', 'image/jpeg'),
      makeFile('b.png', 'image/png'),
      makeFile('c.webp', 'image/webp'),
    ]);

    expect(accepted).toHaveLength(3);
    expect(rejected).toHaveLength(0);
  });

  it('rejects SVG, which can carry script', () => {
    const { accepted, rejected } = validateSelectedFiles([makeFile('c.svg', 'image/svg+xml')]);

    expect(accepted).toHaveLength(0);
    expect(rejected[0]?.fileName).toBe('c.svg');
  });

  it.each([
    ['script.js', 'text/javascript'],
    ['page.html', 'text/html'],
    ['setup.exe', 'application/x-msdownload'],
    ['notes.pdf', 'application/pdf'],
  ])('rejects %s', (name, type) => {
    expect(validateSelectedFiles([makeFile(name, type)]).accepted).toHaveLength(0);
  });

  it('falls back to the file extension when the browser reports no type', () => {
    const { accepted, rejected } = validateSelectedFiles([
      makeFile('holiday.JPEG', ''),
      makeFile('notes.txt', ''),
    ]);

    expect(accepted.map((file) => file.name)).toEqual(['holiday.JPEG']);
    expect(rejected).toHaveLength(1);
  });

  it('rejects a photograph larger than the size limit', () => {
    const { accepted, rejected } = validateSelectedFiles([
      makeFile('huge.jpg', 'image/jpeg', maxBytesPerFile + 1),
    ]);

    expect(accepted).toHaveLength(0);
    expect(rejected[0]?.reason).toContain('larger than');
  });

  it('allows a photograph of exactly the size limit', () => {
    const { accepted } = validateSelectedFiles([
      makeFile('exact.jpg', 'image/jpeg', maxBytesPerFile),
    ]);

    expect(accepted).toHaveLength(1);
  });

  it('rejects an empty file', () => {
    expect(validateSelectedFiles([makeFile('empty.jpg', 'image/jpeg', 0)]).accepted).toHaveLength(0);
  });

  it('stops at the maximum number of photographs', () => {
    const files = Array.from({ length: maxFiles + 3 }, (_, index) =>
      makeFile(`photo-${index}.jpg`, 'image/jpeg'),
    );

    const { accepted, rejected } = validateSelectedFiles(files);

    expect(accepted).toHaveLength(maxFiles);
    expect(rejected).toHaveLength(3);
    expect(rejected[0]?.reason).toContain(String(maxFiles));
  });

  it('counts photographs that were already selected', () => {
    const alreadySelected = Array.from({ length: maxFiles - 1 }, (_, index) =>
      makeFile(`existing-${index}.jpg`, 'image/jpeg'),
    );

    const { accepted, rejected } = validateSelectedFiles(
      [makeFile('new-1.jpg', 'image/jpeg'), makeFile('new-2.jpg', 'image/jpeg')],
      alreadySelected,
    );

    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });

  it('does not select the same photograph twice', () => {
    const file = makeFile('same.jpg', 'image/jpeg');

    const { accepted, rejected } = validateSelectedFiles([file], [file]);

    expect(accepted).toHaveLength(0);
    expect(rejected[0]?.reason).toContain('already been selected');
  });
});
