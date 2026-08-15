import { useSiteConfig } from '../context/SiteConfigContext';
import styles from './Layout.module.css';

export function Footer() {
  const { siteConfig } = useSiteConfig();
  const name = siteConfig?.name ?? '';

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.footerInner}`}>
        <p>{name ? `In memory of ${name}.` : 'A place to remember and share memories.'}</p>
        <p>Shared with love by family and friends.</p>
      </div>
    </footer>
  );
}
