# ZIDART WEBGIS Dashboard

Dashboard WEBGIS static, gata de publicare în GitHub Pages.

## Conținut
- `index.html` – aplicația
- `style.css` – stilizare modernă
- `app.js` – logica hărții, popup-urilor, cardurilor și graficului
- `zidart.geojson` – datele sursă

## Funcționalități
- hartă Leaflet cu basemap gri OpenStreetMap/CARTO Positron
- legendă automată după câmpul `layer`
- popup modern pentru fiecare lucrare
- galerie foto în popup cu deschidere în tab nou
- card cu numărul total de lucrări
- pie chart cu distribuția lucrărilor după `layer`
- filtrare după layer din legendă sau chart

## Publicare în GitHub
1. Repository-ul conține deja fișierele site-ului static.
2. În GitHub mergi la `Settings` > `Pages`.
3. La `Build and deployment`, alege:
   - `Source: Deploy from a branch`
   - branch: `main`
   - folder: `/ (root)`
4. Salvezi.
5. GitHub Pages va publica aplicația pe URL-ul repository-ului.

## Observații
- Aplicația este statică și nu are nevoie de build.
- Pentru funcționare pe GitHub Pages este important să păstrezi `zidart.geojson` în același folder cu `index.html`.
