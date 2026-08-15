import { describe, expect, it } from 'vitest';
import { appConfig } from '../config/appConfig';
import { isValidMemoryForm, toNewMemory, validateMemoryForm } from './memoryValidation';

const { maxNameLength, maxMessageLength } = appConfig.memoryForm;

describe('validateMemoryForm', () => {
  it('accepts a completed form', () => {
    const errors = validateMemoryForm({ name: 'Alex', message: 'A memory worth keeping.' });
    expect(errors).toEqual({});
    expect(isValidMemoryForm(errors)).toBe(true);
  });

  it('requires a name', () => {
    expect(validateMemoryForm({ name: '', message: 'A memory.' }).name).toBe(
      'Please enter your name.',
    );
  });

  it('treats whitespace as missing', () => {
    const errors = validateMemoryForm({ name: '   ', message: '\n\t ' });
    expect(errors.name).toBeDefined();
    expect(errors.message).toBeDefined();
    expect(isValidMemoryForm(errors)).toBe(false);
  });

  it('requires a message', () => {
    expect(validateMemoryForm({ name: 'Alex', message: '' }).message).toBe(
      'Please write your memory before submitting.',
    );
  });

  it('rejects a name beyond the maximum length', () => {
    const errors = validateMemoryForm({ name: 'a'.repeat(maxNameLength + 1), message: 'A memory.' });
    expect(errors.name).toContain(String(maxNameLength));
  });

  it('allows a name of exactly the maximum length', () => {
    const errors = validateMemoryForm({ name: 'a'.repeat(maxNameLength), message: 'A memory.' });
    expect(errors.name).toBeUndefined();
  });

  it('rejects a message beyond the maximum length', () => {
    const errors = validateMemoryForm({ name: 'Alex', message: 'a'.repeat(maxMessageLength + 1) });
    expect(errors.message).toContain(String(maxMessageLength));
  });
});

describe('toNewMemory', () => {
  it('trims the values it passes to the service', () => {
    expect(toNewMemory({ name: '  Alex  ', message: '  A memory.  ' })).toEqual({
      name: 'Alex',
      message: 'A memory.',
    });
  });
});
