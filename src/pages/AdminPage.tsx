import { useCallback, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../components/StatePanel';
import { appConfig } from '../config/appConfig';
import { useSiteConfig } from '../context/SiteConfigContext';
import { useAsyncData } from '../hooks/useAsyncData';
import type { IssuedInvite, ModerationQueue } from '../models/Moderation';
import type { SiteConfig } from '../models/SiteConfig';
import { adminService } from '../services/adminService';
import { toUserMessage } from '../utils/errors';
import { formatDateTime } from '../utils/formatDate';
import styles from './AdminPage.module.css';

type Busy = { id: string } | null;

/**
 * Everything an administrator does: clear the queue, edit the memorial's
 * details, and replace the family invitation.
 *
 * Cloudflare Access guards this path at the edge, and the Worker checks every
 * request behind it. Neither depends on this component.
 */
export function AdminPage() {
  return (
    <div className="container">
      <header className="page-header">
        <h1>Looking after this memorial</h1>
        <p>
          Nothing family and friends submit appears on the site until you approve it here.
        </p>
      </header>

      <div className={styles.sections}>
        <ModerationSection />
        <MemorialDetailsSection />
        <InvitationSection />
      </div>
    </div>
  );
}

function ModerationSection() {
  const { data, status, error, reload } = useAsyncData<ModerationQueue>(
    () => adminService.getQueue(),
    'The queue could not be loaded.',
  );
  const [busy, setBusy] = useState<Busy>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const act = useCallback(
    async (id: string, action: () => Promise<void>) => {
      setBusy({ id });
      setFailure(null);
      try {
        await action();
        reload();
      } catch (cause) {
        setFailure(toUserMessage(cause, 'That could not be saved. Please try again.'));
      } finally {
        setBusy(null);
      }
    },
    [reload],
  );

  const waiting = (data?.memories.length ?? 0) + (data?.photos.length ?? 0);

  return (
    <section className={styles.section} aria-labelledby="queue-heading">
      <div className={styles.sectionHeader}>
        <h2 id="queue-heading">Waiting for you</h2>
        {status === 'success' ? (
          <span className={styles.count}>
            {waiting} {waiting === 1 ? 'item' : 'items'}
          </span>
        ) : null}
      </div>

      {failure ? (
        <div className="notice notice--error" role="alert">
          <p>{failure}</p>
        </div>
      ) : null}

      {status === 'loading' ? <LoadingState label="Loading the queue…" /> : null}
      {status === 'error' ? (
        <ErrorState message={error ?? 'The queue could not be loaded.'} onRetry={reload} />
      ) : null}

      {status === 'success' && data !== null ? (
        waiting === 0 ? (
          <EmptyState title="Nothing is waiting">
            <p>Everything shared so far has been dealt with.</p>
          </EmptyState>
        ) : (
          <>
            {data.memories.map((memory) => (
              <article key={memory.id} className={`card ${styles.queueItem}`}>
                <div className={styles.queueMeta}>
                  <h3 className={styles.queueName}>{memory.name}</h3>
                  <time className={styles.queueDate} dateTime={memory.created}>
                    {formatDateTime(memory.created)}
                  </time>
                </div>
                <p className={styles.queueMessage}>{memory.message}</p>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className="button"
                    disabled={busy?.id === memory.id}
                    onClick={() => act(memory.id, () => adminService.approveMemory(memory.id))}
                  >
                    Publish this memory
                  </button>
                  <button
                    type="button"
                    className="button button--quiet"
                    disabled={busy?.id === memory.id}
                    onClick={() => act(memory.id, () => adminService.removeMemory(memory.id))}
                  >
                    Delete permanently
                  </button>
                </div>
              </article>
            ))}

            {data.photos.length > 0 ? (
              <ul className={styles.photoGrid}>
                {data.photos.map((photo) => (
                  <li key={photo.id} className={`card ${styles.queueItem}`}>
                    <img
                      className={styles.queuePreview}
                      src={photo.thumbnailUrl}
                      alt={photo.caption ?? 'A photograph waiting to be approved'}
                      loading="lazy"
                    />
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className="button"
                        disabled={busy?.id === photo.id}
                        onClick={() => act(photo.id, () => adminService.approvePhoto(photo.id))}
                      >
                        Publish
                      </button>
                      <button
                        type="button"
                        className="button button--quiet"
                        disabled={busy?.id === photo.id}
                        onClick={() => act(photo.id, () => adminService.removePhoto(photo.id))}
                      >
                        Delete permanently
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )
      ) : null}
    </section>
  );
}

const FIELDS: { name: keyof SiteConfig; label: string; hint?: string; multiline?: boolean }[] = [
  { name: 'title', label: 'Heading', hint: 'Shown above the name, for example "In Loving Memory".' },
  { name: 'name', label: 'Name' },
  { name: 'dateOfBirth', label: 'Date of birth', hint: 'Year-month-day, e.g. 1938-04-17. Leave blank if you would rather not say.' },
  { name: 'dateOfDeath', label: 'Date of death', hint: 'Leave blank if you would rather not say.' },
  { name: 'welcomeText', label: 'Introduction', multiline: true },
  { name: 'mainPhoto', label: 'Main photograph', hint: 'A web address for the photograph, or blank.' },
];

function MemorialDetailsSection() {
  const { siteConfig, status, reload } = useSiteConfig();
  const [draft, setDraft] = useState<SiteConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const values = draft ?? siteConfig;

  async function save() {
    if (values === null) return;
    setSaving(true);
    setFailure(null);
    setSaved(false);
    try {
      await adminService.saveSiteConfig(values);
      setSaved(true);
      reload();
    } catch (cause) {
      setFailure(toUserMessage(cause, 'Those details could not be saved. Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.section} aria-labelledby="details-heading">
      <div className={styles.sectionHeader}>
        <h2 id="details-heading">Memorial details</h2>
      </div>

      {status === 'loading' || values === null ? (
        <LoadingState label="Loading the details…" />
      ) : (
        <form
          className="card"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          {saved ? (
            <div className="notice notice--success notice--spaced" role="status">
              <p>Saved. The site now shows these details.</p>
            </div>
          ) : null}

          {failure ? (
            <div className="notice notice--error notice--spaced" role="alert">
              <p>{failure}</p>
            </div>
          ) : null}

          {FIELDS.map((field) => (
            <div className="field" key={field.name}>
              <label className="field__label" htmlFor={`config-${field.name}`}>
                {field.label}
              </label>
              {field.hint ? (
                <span className="field__hint" id={`config-${field.name}-hint`}>
                  {field.hint}
                </span>
              ) : null}
              {field.multiline === true ? (
                <textarea
                  id={`config-${field.name}`}
                  className="field__control"
                  rows={4}
                  value={values[field.name]}
                  aria-describedby={field.hint ? `config-${field.name}-hint` : undefined}
                  onChange={(event) => setDraft({ ...values, [field.name]: event.target.value })}
                  disabled={saving}
                />
              ) : (
                <input
                  id={`config-${field.name}`}
                  type="text"
                  className="field__control"
                  value={values[field.name]}
                  aria-describedby={field.hint ? `config-${field.name}-hint` : undefined}
                  onChange={(event) => setDraft({ ...values, [field.name]: event.target.value })}
                  disabled={saving}
                />
              )}
            </div>
          ))}

          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Saving…' : 'Save details'}
          </button>
        </form>
      )}
    </section>
  );
}

function InvitationSection() {
  const [issued, setIssued] = useState<IssuedInvite | null>(null);
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function rotate() {
    setWorking(true);
    setFailure(null);
    try {
      setIssued(await adminService.rotateInvite());
    } catch (cause) {
      setFailure(toUserMessage(cause, 'A new invitation could not be created.'));
    } finally {
      setWorking(false);
    }
  }

  const link = issued === null ? null : `${window.location.origin}${appConfig.baseUrl}invite/${issued.token}`;

  return (
    <section className={styles.section} aria-labelledby="invite-heading">
      <div className={styles.sectionHeader}>
        <h2 id="invite-heading">The family invitation</h2>
      </div>

      <div className="card">
        <p>
          Anyone with the invitation link can add memories and photographs, which then wait here for
          you. Creating a new one <strong>signs out everybody using the old link</strong> — which is
          what to do if it has been passed around more widely than you meant.
        </p>

        {failure ? (
          <div className="notice notice--error notice--spaced" role="alert">
            <p>{failure}</p>
          </div>
        ) : null}

        {link !== null ? (
          <div className="notice notice--success" role="status">
            <p className="notice__heading">Here is the new invitation link</p>
            <p>Copy it now — it cannot be shown again.</p>
            <code className={styles.inviteToken}>{link}</code>
          </div>
        ) : null}

        <p className={styles.rotateAction}>
          <button type="button" className="button button--secondary" onClick={rotate} disabled={working}>
            {working ? 'Creating…' : 'Create a new invitation link'}
          </button>
        </p>
      </div>
    </section>
  );
}
