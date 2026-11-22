# team-15 Platanus Hack 26: Santiago ft. Buk Project

**Current project logo:** project-logo.png

<img src="./project-logo.png" alt="Project Logo" width="200" />

Track: 🌎 Physical World

team-15

- Nicolas Del Valle Ruiz ([@nico-del-valle](https://github.com/nico-del-valle))
- Felipe Andrés Mellado Bórquez ([@Phiripp](https://github.com/Phiripp))
- Tomás Rodrigo Morales Garcia ([@tmorals](https://github.com/tmorals))
- Gabriela Acuña Benito ([@gabiacuna](https://github.com/gabiacuna))

## Caudal

Caudal finds, from satellite images, farms that irrigate without water rights, and tells Chile's water authority (DGA) which ones to inspect first.

Live: <https://caudales.dev> · Full description: [project-description.md](project-description.md)

## What it does

1. **Spots irrigation.** In summer, when the hills are dry, a farm that stays green and moist is being watered.
2. **Compares with water rights.** It estimates the water the crop needs and compares it with the rights registered for that farm.
3. **Ranks 7,911 farms** in Petorca and lower Aconcagua, and plans a one-day inspection route.
4. **Builds the complaint file.** A PDF with the fields of the DGA's official complaint form, generated on the server.

Every alert says why it exists, where each number comes from and what Caudal does not know.

## Does it work?

- The DGA fined a farm in Hijuelas 1,983.9 UTM after a 2021 inspection. Caudal has it on high alert from the 2019-20 season, two years earlier.
- Checked against the farms the DGA already fined: an inspector who starts with the farms Caudal flags finds 2.6 times more infractions than one who picks without that list (95% interval 1.3 to 4.4, 19 cases). Details in [docs/validacion.md](docs/validacion.md).

## What is live and what is precomputed

- **Precomputed, in batch:** satellite series, irrigation signal, water use, score, route. Scripts in `scripts/`, results in `data/processed/`.
- **Live:** the API queries those files on each request, writes the "why is this farm on alert" text, and builds the complaint PDF when asked (about 5 seconds for a new one; the demo ones are built with the image and the page shows their date).

Nothing on the page is typed in by hand. More in [docs/en-vivo-y-precalculado.md](docs/en-vivo-y-precalculado.md).

## Repository

| Path | What it is |
| --- | --- |
| `scripts/extract/` | Downloads and joins the public data: farms, water rights, inspections, crops, canals, weather, satellite series |
| `scripts/models/` | Dry spells, anomalies against dryland, irrigation detector, water use, score, validation, calibration, impact, route, complaint PDF |
| `api/` | `caudal-api`: FastAPI with DuckDB over the Parquet files. [api/README.md](api/README.md) |
| `frontend-demo/` | The page: MapLibre and three.js, static, served with nginx |
| `data/` | Processed data and its documentation. [data/README.md](data/README.md) |
| `docs/` | Specs, validation, calibration, impact and the pitch |
| `infra/` | Terraform for the GCP jobs |

## Run it

```bash
# API (needs data/processed/predio.parquet: uv run scripts/extract/predios_ciren.py)
uv run --with-requirements api/requirements.txt uvicorn api.main:app --port 8080

# Page
cd frontend-demo && python3 -m http.server 8000     # open http://localhost:8000
```

The order of the full pipeline is in [docs/en-vivo-y-precalculado.md](docs/en-vivo-y-precalculado.md#cómo-se-reproduce).

## Limits

- Caudal ranks; it does not accuse. It gives signs and ranges. Only an inspector can confirm an infraction.
- It sees that a farm is irrigated, not where the water comes from. Canal water held as shares is not in the rights registry, so farms next to a canal are flagged with a warning.
- No owner names anywhere. The property number (rol) is shown only for farms with a fine already issued by the DGA.

## Data

Sentinel-2 (Copernicus), DGA (water rights, inspections, streams), CIREN (farm boundaries, fruit census, canals), CONAF (land use), DMC and Open-Meteo (weather).
