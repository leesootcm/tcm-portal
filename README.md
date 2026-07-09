# TCM Portal

## Local dev
npm install
npm run dev

## Build
npm run build
# outputs to dist/ — this is what you deploy

## Free hosting options
1. Vercel (github.com login) — import this repo, it auto-detects Vite, deploys on every push.
2. Netlify — same as above, or drag-and-drop the built `dist/` folder at app.netlify.com/drop.
3. GitHub Pages — needs `base: '/repo-name/'` added to vite.config.js, then `npm run build` + push `dist/` to a `gh-pages` branch.

Content lives in public/tcm-content.json — edit that file (not App.jsx) to add more chapters.
