import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="container container--reading">
      <header className="page-header">
        <h1>Page not found</h1>
        <p>Sorry — that page does not exist, or it may have moved.</p>
      </header>
      <p>
        <Link to="/" className="button">
          Return to the home page
        </Link>
      </p>
    </div>
  );
}
