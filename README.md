# Julia's Garden

Julia's Garden is a browser fractal explorer. The left panel shows parameter space, the right panel shows the matching Julia set, and you can switch between `z^n + c`, transcendental examples, or your own formula.

Drag to pan, scroll to zoom, right click to lock it and use `Reset` if you get lost. Grid and Export are available above each display.

For formulas that need it, the two extra inputs are the real and imaginary parts of the starting value `z0`.

To run it locally, serve the folder as a static site, for example:

```bash
python3 -m http.server
```

Then open `http://localhost:8000/`.
