# Traqr — Frontend

React + Vite frontend for Traqr.

**Live:** https://traqr-app.netlify.app
**Backend:** https://github.com/harshgolani/traqr/tree/main/backend

---

## Stack

- React 19
- Vite
- Recharts (analytics bar chart)
- Pure CSS (no component library)

---

## Run locally

```bash
npm install
npm run dev
```

Requires backend running at `http://localhost:3000`. Update the API base URL in `src/App.jsx` to switch between local and production backend.

---

## Structure

src/
├── App.jsx    # All state, handlers, and components
├── App.css    # All styles
└── index.css  # Minimal reset only

---

## Key features

- Shorten any URL — Enter key or button click
- Copy short URL to clipboard with 2-second feedback
- URLs list with relative timestamps
- Inline analytics panel per URL — total clicks, bar chart, top referers
- Optimistic delete — row removed instantly before network request settles
