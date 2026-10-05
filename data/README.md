# data/

Source files copied into `public/geo/` by `scripts/copy-assets.mjs` on every dev start and build.

- `airports.json`: ICAO → [lat, lon] for large and medium airports, from [OurAirports](https://ourairports.com/data/) (public domain). Used to place a fuel en-route alternate on the route map.
- `relief.jpg`: shaded relief for the route map's height-map style, from [Natural Earth](https://www.naturalearthdata.com/) SR_50M (public domain). Resampled to 7200 × 3600 greyscale (equirectangular, 20 px per degree), with levels set so flat land (grey 206) is white, so it only darkens slopes when multiplied over the land colour.
