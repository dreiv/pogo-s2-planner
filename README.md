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

## Import export Wayfarer (manual)

1. Deschide [Wayfarer](https://wayfarer.pokemon-go.community/) în browser.
2. Deschide DevTools → tab **Network**.
3. Fă o căutare / selectează zona dorită în Wayfarer.
4. În tab-ul Network, găsește cererea de date (de obicei `search` / `query`),
   deschide-o și copiază **Response** (JSON).
5. În aplicație: panou lateral → **Import** → lipește JSON-ul (sau încarcă fișierul).

> Formatul așteptat: `result.data[]` = celule `{ metadata: { s2CellId, count }, pois[] }`.
> `metadata.count >= 50` → celula e marcată „posibil incompletă" (trunchiată).

## Confidențialitate

- Datele Wayfarer **nu se comit**. Stau în `local-data/` (gitignored) și în
  IndexedDB (browser). `fixtures/` conține doar date sintetice (fără titluri,
  descrieri sau imagini).
- **Backup**: exportul implicit conține doar marcajele și setările tale.
  Exportul cu dataset (al doilea buton) include și datele Wayfarer — **nu le
  comite și nu le partaja** (date personale / Niantic).
- Fără cereri de rețea în afară de tile-urile OSM (și imaginile POI, încărcate
  doar la deschiderea popup-ului).

## PWA / instalare pe telefon

- Aplicația se instalează (manifest + service worker). Funcționează în teren cu
  datele deja importate.
- **Mod „în teren"**: urmărire continuă a locației (GPS), opțiune de a muta
  centrul range-ului după poziție, fără a bloca panoul manual.
- Service worker-ul face cache **doar** la shell-ul aplicației (JS/CSS/HTML).
  Nu face cache la tile-urile OSM (politica OSM).
- **Actualizare**: când e disponibilă o versiune nouă, apare un dialog cu
  „Refresh" / „Later". „Refresh" activează noul service worker și reîncarcă
  pagina; „Later" ascunde dialogul (versiunea nouă se aplică la următoarea
  sesiune). Pozele POI se încarcă de la CDN-ul Google doar când deschizi
  popup-ul; se pot opri din setări („Show POI photos").

## Publicare pe GitHub Pages

1. Repo public (Pages e gratuit cu repo public).
2. `deploy.yml` rulează build cu `VITE_BASE=/<nume-repo>/` și publică în Pages.
3. În Settings → Pages, sursa e **GitHub Actions**.
4. URL final: `https://<user>.github.io/<nume-repo>/`.
