import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { appConfig } from '../config/appConfig';
import { memoryService } from '../services/memoryService';
import { toUserMessage } from '../utils/errors';
import {
  isValidMemoryForm,
  toNewMemory,
  validateMemoryForm,
  type MemoryFormErrors,
  type MemoryFormValues,
} from '../utils/memoryValidation';

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

const EMPTY_FORM: MemoryFormValues = { name: '', message: '' };
const { maxNameLength, maxMessageLength } = appConfig.memoryForm;

export function AddMemoryPage() {
  const [values, setValues] = useState<MemoryFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<MemoryFormErrors>({});
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  function updateField(field: keyof MemoryFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    // Clear the message for a field as soon as the visitor starts correcting it.
    setErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validateMemoryForm(values);
    setErrors(validationErrors);

    if (!isValidMemoryForm(validationErrors)) {
      // Send keyboard and screen reader users straight to the first problem.
      if (validationErrors.name) nameRef.current?.focus();
      else messageRef.current?.focus();
      return;
    }

    setSubmitState('submitting');
    setSubmitError(null);

    try {
      await memoryService.addMemory(toNewMemory(values));
      setValues(EMPTY_FORM);
      setSubmitState('success');
    } catch (cause) {
      setSubmitError(toUserMessage(cause, 'Your memory could not be saved. Please try again.'));
      setSubmitState('error');
    }
  }

  const isSubmitting = submitState === 'submitting';

  return (
    <div className="container container--reading">
      <header className="page-header">
        <h1>Add a memory</h1>
        <p>
          Share a memory, a message or a few words. Everything you write appears on the{' '}
          <Link to="/memories">Memories</Link> page.
        </p>
      </header>

      {submitState === 'success' ? (
        <div className="notice notice--success notice--spaced" role="status">
          <p className="notice__heading">Thank you — your memory has been added.</p>
          <p>
            {appConfig.useMockData
              ? 'This site is not yet connected to its backend, so the memory is kept only until the page is reloaded.'
              : 'It will now appear on the Memories page.'}
          </p>
        </div>
      ) : null}

      {submitState === 'error' && submitError ? (
        <div className="notice notice--error notice--spaced" role="alert">
          <p className="notice__heading">Your memory could not be saved</p>
          <p>{submitError}</p>
        </div>
      ) : null}

      <form className="card" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="memory-name">
            Your name
          </label>
          <span className="field__hint" id="memory-name-hint">
            Up to {maxNameLength} characters. This is shown with your memory.
          </span>
          <input
            ref={nameRef}
            id="memory-name"
            name="name"
            type="text"
            className="field__control"
            value={values.name}
            onChange={(event) => updateField('name', event.target.value)}
            autoComplete="name"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={
              errors.name ? 'memory-name-error memory-name-hint' : 'memory-name-hint'
            }
            disabled={isSubmitting}
          />
          {errors.name ? (
            <span className="field__error" id="memory-name-error">
              {errors.name}
            </span>
          ) : null}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="memory-message">
            Your memory
          </label>
          <span className="field__hint" id="memory-message-hint">
            Up to {maxMessageLength.toLocaleString('en-GB')} characters.
          </span>
          <textarea
            ref={messageRef}
            id="memory-message"
            name="message"
            className="field__control"
            value={values.message}
            onChange={(event) => updateField('message', event.target.value)}
            rows={8}
            aria-invalid={errors.message ? true : undefined}
            aria-describedby={
              errors.message
                ? 'memory-message-error memory-message-hint'
                : 'memory-message-hint memory-message-counter'
            }
            disabled={isSubmitting}
          />
          {errors.message ? (
            <span className="field__error" id="memory-message-error">
              {errors.message}
            </span>
          ) : (
            <span className="field__counter" id="memory-message-counter">
              {values.message.length.toLocaleString('en-GB')} of{' '}
              {maxMessageLength.toLocaleString('en-GB')} characters used.
            </span>
          )}
        </div>

        <div className="field">
          <span className="field__label">Photograph</span>
          <span className="field__hint">
            Attaching a photograph to a memory will be possible once uploads are connected. For now,
            please add photographs on the <Link to="/upload-photos">Upload Photos</Link> page.
          </span>
        </div>

        <button type="submit" className="button" disabled={isSubmitting}>
          {isSubmitting ? 'Adding your memory…' : 'Add memory'}
        </button>
      </form>
    </div>
  );
}
