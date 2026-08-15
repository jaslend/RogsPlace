import { Link } from 'react-router-dom';
import { ErrorState, LoadingState } from '../components/StatePanel';
import { resolveAssetUrl } from '../config/appConfig';
import { useSiteConfig } from '../context/SiteConfigContext';
import { formatDate } from '../utils/formatDate';
import styles from './HomePage.module.css';

/** "1 January 1940 – 2 February 2020", or an empty string when no dates are known. */
function formatLifeDates(dateOfBirth: string, dateOfDeath: string): string {
  const born = formatDate(dateOfBirth);
  const died = formatDate(dateOfDeath);
  if (born && died) return `${born} – ${died}`;
  return born || died;
}

export function HomePage() {
  const { siteConfig, status, error, reload } = useSiteConfig();

  if (status === 'loading') {
    return <LoadingState label="Loading the memorial…" />;
  }

  if (status === 'error' || siteConfig === null) {
    return <ErrorState message={error ?? 'The memorial details could not be loaded.'} onRetry={reload} />;
  }

  const lifeDates = formatLifeDates(siteConfig.dateOfBirth, siteConfig.dateOfDeath);

  return (
    <div className="container">
      <section className={styles.hero}>
        <figure className={styles.portrait}>
          {siteConfig.mainPhoto ? (
            <img
              src={resolveAssetUrl(siteConfig.mainPhoto)}
              alt={`${siteConfig.name}, remembered here`}
            />
          ) : (
            <div className={styles.portraitPlaceholder}>
              <p>The main photograph has not been added yet.</p>
            </div>
          )}
        </figure>

        <div>
          <span className={styles.eyebrow}>{siteConfig.title}</span>
          <h1 className={styles.name}>{siteConfig.name}</h1>
          {lifeDates ? (
            <p className={styles.dates}>{lifeDates}</p>
          ) : (
            <p className={styles.dates}>Dates to be added.</p>
          )}
          <p className={styles.welcome}>{siteConfig.welcomeText}</p>
        </div>
      </section>

      <section aria-labelledby="explore-heading">
        <h2 id="explore-heading" className="visually-hidden">
          Explore this memorial
        </h2>

        <div className={styles.linkGrid}>
          <Link to="/photos" className={`card ${styles.linkCard}`}>
            <h2>Photographs</h2>
            <p>Look through photographs shared by family and friends.</p>
            <span className={styles.linkCardAction}>View the photographs</span>
          </Link>

          <Link to="/memories" className={`card ${styles.linkCard}`}>
            <h2>Memories</h2>
            <p>Read the memories and messages that people have left.</p>
            <span className={styles.linkCardAction}>Read the memories</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
