import { useEffect, useId, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import styles from './Layout.module.css';

interface NavigationItem {
  to: string;
  label: string;
}

/** The site's top-level navigation, defined in one place. */
export const navigationItems: readonly NavigationItem[] = [
  { to: '/', label: 'Home' },
  { to: '/memories', label: 'Memories' },
  { to: '/photos', label: 'Photos' },
  { to: '/add-memory', label: 'Add a Memory' },
  { to: '/upload-photos', label: 'Upload Photos' },
];

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const menuId = useId();

  // Collapse the small-screen menu once a page has been chosen.
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  return (
    <nav aria-label="Main">
      <button
        type="button"
        className={styles.navToggle}
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((open) => !open)}
      >
        {isOpen ? 'Close menu' : 'Menu'}
      </button>

      <ul id={menuId} className={isOpen ? styles.navList : `${styles.navList} ${styles.navHidden}`}>
        {navigationItems.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
