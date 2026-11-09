# Pogo S2 Planner

Aplicație web personală: hartă OSM + overlay S2 (nivel 14 și 17) + import manual
Wayfarer + instrument de range. Fără backend, fără API keys.

- **S14** ≈ 0.6 km latură (conține exact 64 celule S17). **S17** ≈ 70 m.
- O celulă S17 „ocupată" = conține un POI cu `gmo.entity` POKESTOP/GYM, status
  ACTIVE, `gameBrand` HOLOHOLO (configurabil).
- Funcționează offline (PWA): shell-ul aplicației e în cache, tile-urile OSM nu.

## Rulare

```bash
npm install
npm run dev      # dev server (http://localhost:5173)
npm run check    # lint + typecheck + test + build
npm run build    # build de producție în dist/
```

## Date inițiale

Harta vine pre-populată: `src/data/seed/initial-backup.json` (un backup complet) se încarcă o singură dată,
într-un chunk separat, când baza de date a browserului e goală (prima deschidere sau după „Delete all” + reload).
Ca să schimbi datele inițiale, înlocuiește fișierul cu un backup nou exportat din aplicație
(Backup → export cu dataset).

## Import export Wayfarer (manual)

1. Deschide [Wayfarer](https://wayfarer.scopely.com/mapview?z=16) în browser.
2. Deschide DevTools → tab **Network**.
3. Fă o căutare / selectează zona dorită în Wayfarer.
4. În tab-ul Network, găsește cererea de date (de obicei `search` / `query`),
   deschide-o și copiază **Response** (JSON).
5. În aplicație: panou lateral → **Import** → lipește JSON-ul (sau încarcă fișierul).

> Formatul așteptat: `result.data[]` = celule `{ metadata: { s2CellId, count }, pois[] }`.
> `metadata.count >= 50` → celula e marcată „posibil incompletă" (trunchiată).

## PWA / instalare pe telefon

- Aplicația se instalează (manifest + service worker). Funcționează în teren cu
  datele deja importate.
- Butonul de locație de pe hartă arată poziția ta curentă.
- Service worker-ul face cache **doar** la shell-ul aplicației (JS/CSS/HTML).
  Nu face cache la tile-urile OSM (politica OSM).
- **Actualizare**: când e disponibilă o versiune nouă, apare un dialog cu
  „Refresh" / „Later". „Refresh" activează noul service worker și reîncarcă
  pagina; „Later" ascunde dialogul (versiunea nouă se aplică la următoarea
  sesiune). Pozele POI se încarcă de la CDN-ul Google doar când deschizi
  popup-ul.

## Publicare pe GitHub Pages

1. Repo public (Pages e gratuit cu repo public).
2. `deploy.yml` rulează build cu `VITE_BASE=/<nume-repo>/` și publică în Pages.
3. În Settings → Pages, sursa e **GitHub Actions**.
4. URL final: `https://<user>.github.io/<nume-repo>/`.
