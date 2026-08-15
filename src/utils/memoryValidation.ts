import { appConfig } from '../config/appConfig';
import type { NewMemory } from '../models/Memory';

export interface MemoryFormValues {
  name: string;
  message: string;
}

/** Field name to message. An empty object means the form is valid. */
export type MemoryFormErrors = Partial<Record<keyof MemoryFormValues, string>>;

const { maxNameLength, maxMessageLength } = appConfig.memoryForm;

/**
 * Validates the Add a Memory form.
 *
 * The same rules will be applied again by the Worker: browser validation is for
 * helpfulness, not for safety.
 */
export function validateMemoryForm(values: MemoryFormValues): MemoryFormErrors {
  const errors: MemoryFormErrors = {};

  const name = values.name.trim();
  if (name === '') {
    errors.name = 'Please enter your name.';
  } else if (name.length > maxNameLength) {
    errors.name = `Please keep your name to ${maxNameLength} characters or fewer.`;
  }

  const message = values.message.trim();
  if (message === '') {
    errors.message = 'Please write your memory before submitting.';
  } else if (message.length > maxMessageLength) {
    errors.message = `Please keep your memory to ${maxMessageLength} characters or fewer.`;
  }

  return errors;
}

export function isValidMemoryForm(errors: MemoryFormErrors): boolean {
  return Object.keys(errors).length === 0;
}

/** Trims the form values into the shape the service expects. */
export function toNewMemory(values: MemoryFormValues): NewMemory {
  return {
    name: values.name.trim(),
    message: values.message.trim(),
  };
}
