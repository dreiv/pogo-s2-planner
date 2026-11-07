# AGENTS.md

## Scop

Aplicație web personală (Vue 3 + Leaflet + OSM) care desenează grile S2 nivel 14 și 17
și arată, pe baza unui export manual din Wayfarer, ce celule S17 sunt ocupate de
Pokéstop/Gym. Are și un instrument de range (80–500 m).

## Reguli

- Cod și comentarii în engleză; UI în engleză.
- `src/core/**` = TypeScript pur, zero import din vue/leaflet/dexie. Toată logica
  (S2, geo, parser, clasificare, statistici) stă aici și are teste Vitest.
- Leaflet doar în `src/map/**`. Dexie doar în `src/data/**`. Pinia în `src/stores/**`.
- Fără backend, fără API keys, fără cereri de rețea în afară de tile-urile OSM
  (și imaginile POI, încărcate doar la deschiderea popup-ului).
- Nu comite date reale Wayfarer: stau în `local-data/` (gitignored). `fixtures/` conține
  doar date sintetice; sunt permise titluri/ID-uri de poză EVIDENT sintetice
  (ex. "Synthetic Stop A", `SYNTHETICIMAGEID…`); niciodată date reale.
- Fără scraping/automatizare Wayfarer. Importul e manual (fișier sau paste).
- TypeScript strict, fără `any` nejustificat.
- Nu depăși scopul fazei curente. Dacă planul nu se potrivește cu realitatea (API de
  bibliotecă, performanță), oprește-te, notează în docs/DECISIONS.md și propune alternativa.
- La finalul fiecărei faze: `npm run check`, apoi actualizează docs/PROGRESS.md
  (făcut / abateri / întrebări deschise) și docs/DECISIONS.md.

## Domeniu

- S14 ≈ 0.6 km latură, conține exact 64 celule S17. S17 ≈ 70 m.
- Celulă S17 „ocupată” = conține un POI cu gmo.entity POKESTOP sau GYM, status ACTIVE,
  gameBrand HOLOHOLO (configurabil). POWERSPOT: setare „contează ca ocupat?”, implicit nu.
- Gym-uri per S14 (regula comunității, de verificat și configurabilă): 1 la 2 POI,
  2 la 6, 3 la 20 (POI = stop + gym).
- Format Wayfarer: result.data[] = celule { metadata{s2CellId (token S14), count},
  pois[] } sau { cellId, pois: [] } (celule goale, fără metadata).
  POI: latE6/lngE6 (÷1e6), gmo[] (poate fi gol; brand în `gameBrand`),
  `mainImage` (URL poză), isCommunityContributed.
  `result.snapshot` = string "YYYY-MM-DD".
- `metadata.count >= 50` => celula poate fi trunchiată, marcheaz-o „posibil incompletă”.
- Snapshot-ul e o fotografie: nominalizările în review nu apar în date.

## Structură

src/core src/data src/map src/stores src/components
fixtures/ local-data/ docs/{PLAN,PROGRESS,DECISIONS}.md scripts/pack.mjs
