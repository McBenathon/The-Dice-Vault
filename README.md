# The Dice Vault

A browser-based D&D dice roller for attacks, healing, and any other dice-based actions. Link each action to one named character or enemy and filter/group the list by entity. Actions are saved in the current browser's local storage; there is no server-side database or account sync. Export a JSON backup to move your collection to another browser or device.

## Run locally

Install Node.js, then run:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. To create and test a production build:

```sh
npm run build
npm run preview
```

## Static hosting

Deploy this project to a static hosting provider such as Netlify, Vercel, or Cloudflare Pages with:

- Build command: `npm run build`
- Publish/output directory: `dist`

The site is fully client-side, so it does not need the Flask backend. Browser local storage is specific to the browser and device and may be cleared by browser settings; use Export for backups. Importing a file replaces the current action list after confirmation.

## Import/export file

Exports use a JSON object with format identifier `dnd-roller-actions` and version `3`; each action includes its optional character/enemy type and name, and the file includes the roll-to-hit modifier. The importer accepts version 3, previous version 1 and 2 action exports, version 1 `dnd-roller-attacks` exports, and the earlier unversioned JSON array format. Older actions import as unassigned and older exports default the hit modifier to zero.
