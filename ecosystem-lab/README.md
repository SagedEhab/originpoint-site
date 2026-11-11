# Ecosystem lab (not part of the live site)

Prototype for the "Living Ecosystem" home page: one miniature business built as real 3D
(three.js r170), five connected zones on one limestone platform, four lighting acts.

- `scene.js`: the model, materials, pathways and the four lighting acts. Exports `build()`.
- `render.html`: renders one frame. Query params: `act=1..4`, `cam=master|dolly|top|studio`,
  `hide=zones` (foundation only), `w`, `h`.

Open via any static server, e.g. `python3 -m http.server` in the repo root, then
`/ecosystem-lab/render.html?act=4&cam=master`. Colours are the exact palette from AGENTS.md.
Nothing here is linked from the site yet.
