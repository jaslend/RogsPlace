# Placeholder data

These files stand in for the Worker API while it does not exist yet. They are
loaded by the services in `src/services/` whenever `VITE_API_URL` is unset.

- `site.json` — home page content. Dates and the main photograph are
  deliberately blank; the UI marks them as "to be added" rather than inventing
  anything.
- `memories.json` — demonstration memories only. Every entry has a `demo-`
  prefixed id and says so in its text. Emptying the array to `[]` removes them
  all.
- `photos.json` — demonstration gallery entries pointing at the placeholder
  images in `public/placeholders/`.

None of this content describes a real person or event.
