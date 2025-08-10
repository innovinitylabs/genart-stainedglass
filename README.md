Generative Stained Glass (p5.js)

Seeded stained-glass generator using p5.js and d3-delaunay for Voronoi tessellation. Designed for predictable randomness, iterative explorations, and exportable outputs.

Run locally
- Open `index.html` via a local server (already started in this workspace) or any static server.
- Controls: `N` new seed, `S` save PNG.
- URL params:
  - `seed` number (deterministic)
  - `cells` number of mosaic pieces (default ~140)
  - `w`, `h` for canvas size

Example:
http://localhost:5500/?cells=120&seed=4242&w=1200&h=1500

Structure
- `index.html`: entry, loads p5 and d3-delaunay
- `palettes.js`: simple palette slots
- `sketch.js`: full generator (Voronoi, glass fill, lead network)

Notes
- Lead came is drawn in two passes: base seam + variable-width overdraw with a soft highlight.
- Each polygon is clipped and filled with a radial gradient and faint streaks to emulate glass.

License
MIT

