/**
 * Site-level content for the memorial.
 *
 * Served from src/data/site.json during initial development, and later from
 * the Worker API (GET /api/config, backed by configuration/site.json in R2).
 */
export interface SiteConfig {
  /** Heading shown above the name, e.g. "In Loving Memory". */
  title: string;
  /** Name of the person being remembered. */
  name: string;
  /** ISO 8601 date, or an empty string when not yet supplied. */
  dateOfBirth: string;
  /** ISO 8601 date, or an empty string when not yet supplied. */
  dateOfDeath: string;
  /** Short introductory paragraph for the home page. */
  welcomeText: string;
  /** Main memorial photograph, or an empty string when not yet supplied. */
  mainPhoto: string;
}
