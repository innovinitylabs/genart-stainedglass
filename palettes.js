// Minimal palette system. We can tweak later.
const PALETTES = [
  {
    name: "strawberry-mint",
    // light paper, muted greens, pink/vermillion inks, graphite line
    background: "#efece6",
    inks: ["#e25b73", "#ffb8c4", "#6ba28f", "#95c1ad", "#e8dccd"],
    line: "#3d4a4a",
    highlight: "#ffd98c"
  },
  {
    name: "copper-sage",
    background: "#efe9df",
    inks: ["#d46a5f", "#f3b59f", "#779a84", "#a4b8a8", "#e7dbc9"],
    line: "#2f3838",
    highlight: "#ffd27a"
  }
];

function pickPalette(seedIndex = 0) {
  return PALETTES[Math.abs(seedIndex) % PALETTES.length];
}


