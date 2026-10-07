# data/

Source files copied into `public/geo/` by `scripts/copy-assets.mjs` on every dev start and build.

- `airports.json`: ICAO → [lat, lon] for large and medium airports, from [OurAirports](https://ourairports.com/data/) (public domain). Used to place a fuel en-route alternate on the route map.
- `terrain/`: height bands (200, 500, 1000, 1500, 2000, 3000 m) and sea-depth bands (200, 1000, 2000, 4000 m) for the route map's Elevation style, as delta-encoded polygons in 30° × 30° tiles (`<west lon>_<south lat>.json`). Built by `node scripts/build-terrain.mjs` from [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (open data; sources include SRTM, GMTED2010 and ETOPO1), sampled on a 0.1° grid, lightly smoothed, contoured and simplified. The look follows ofp-planner's map.
