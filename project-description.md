# Caudal

**Caudal finds, from satellite images, farms that irrigate without water rights, and tells Chile's water authority which ones to inspect first.**

Live: <https://caudales.dev>

## The problem

In Petorca, 40,000 people have had to live on 50 liters of water a day, delivered by truck. In 2023 and 2024 the state contracted more than CLP 5,700 million in water trucks for that province alone. In the same valleys, orchards stay green all summer, and some have no water rights.

Today this is found almost only when a neighbor files a complaint. The water authority (Dirección General de Aguas, DGA) has few inspectors for thousands of farms.

## What it does

Caudal checks 7,911 farms in two areas of the Valparaíso region, Petorca and lower Aconcagua.

1. **It spots irrigation.** In summer, when the hills are dry, a farm that stays green and moist is being watered.
2. **It compares with water rights.** It estimates how much water the crop needs and compares it with the rights registered for that farm. If the farm uses more than its rights allow, it goes on alert.
3. **It tells the inspector where to go.** A ranking, a one-day driving route, and the points to check inside each farm.
4. **It prepares the complaint.** One click builds a PDF with the fields of the DGA's official complaint form. A person reviews it, signs it and files it.

Every alert says why it exists, where each number comes from, and what Caudal does not know.

## Does it work?

- **A real case, two years early.** In November 2021 the DGA inspected an avocado farm in Hijuelas and later fined it 1,983.9 UTM (about CLP 144 million at today's UTM) for taking water without rights. Caudal has that farm on high alert from the 2019-20 season, the first one we analyzed.
- **More than twice the hits.** We checked Caudal against the farms the DGA has already fined. An inspector who starts with the farms Caudal flags finds 2.6 times more infractions than one who picks without that list (95% interval: 1.3 to 4.4; 19 cases, so the interval is wide).

## How big is it?

- **501 farms** are on high alert today and have had no inspection within 500 m since 2018.
- Together they use an estimated **2.1 to 9.3 million m³ a year** without registered rights. At 100 liters per person per day, that is the water of 34,000 to 256,000 people.
- The DGA runs about 33 water-extraction inspections a year in these two areas. At that pace, checking those farms one by one would take **14 years**. Caudal says which five to visit tomorrow.

## Why now

The satellite passes every 5 days and its images are free. The water-rights registry, the inspection records and the farm boundaries are public. Nobody had joined them farm by farm. The same data covers all of Chile.

## Who it is for

The DGA and the local water boards (juntas de vigilancia) that must decide where to send an inspector. It also helps rural communities that today file complaints without evidence.

## What is real

Everything on the page comes from files that the scripts in this repository produce; nothing is typed in by hand. The scores are computed in batch. The complaint PDF is built on the server when you ask for it. Details: [docs/en-vivo-y-precalculado.md](docs/en-vivo-y-precalculado.md). Validation: [docs/validacion.md](docs/validacion.md).

Caudal ranks; it does not accuse. It gives signs and ranges, with their confidence. Only an inspector can confirm an infraction.

Under the hood: Sentinel-2 imagery (Copernicus), FAO-56 crop water use, DGA water rights and inspections, CIREN farm boundaries and crops, CONAF land use, Open-Meteo and DMC weather.

## Team

Nicolás del Valle, Felipe Mellado, Tomás Morales and Gabriela Acuña · Platanus Hack 26 Santiago, Physical World track.
