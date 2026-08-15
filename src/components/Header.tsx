import { Link } from 'react-router-dom';
import { useSiteConfig } from '../context/SiteConfigContext';
import styles from './Layout.module.css';
import { Navigation } from './Navigation';

export function Header() {
  const { siteConfig } = useSiteConfig();

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link to="/" className={styles.brand}>
          <span className={styles.brandEyebrow}>{siteConfig?.title ?? 'In Loving Memory'}</span>
          <span className={styles.brandName}>{siteConfig?.name ?? 'RogsPlace'}</span>
        </Link>
        <Navigation />
      </div>
    </header>
  );
}
