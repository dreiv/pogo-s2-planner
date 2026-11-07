# Pogo S2 Planner

Aplicație web personală: hartă OSM + overlay S2 (nivel 14 și 17) + import manual Wayfarer

- instrument de range. Fără backend, fără API keys.

## Rulare

```bash
npm install
npm run dev      # dev server
npm run check    # lint + typecheck + test + build
```

## Confidențialitate

Datele Wayfarer **nu se comit**. Stau în `local-data/` (gitignored) și în IndexedDB
(browser). `fixtures/` conține doar date sintetice.

## Bucla de lucru

1. Branch `phase-N`, lipești promptul fazei din `docs/PLAN.md` în agent.
2. `npm run check` trebuie să treacă.
3. `npm run pack -- N` → `.repomix/phase-N.xml`.
4. Chat nou, atașezi fișierul, lipești promptul din `docs/prompts/review.md`.
5. Dacă apar probleme: `docs/prompts/realign.md` în agent.
6. Merge, apoi `git tag phase-N`.
