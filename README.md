# Extent

*or, All the Changes on Four Bells*

Four bells can stand in twenty-four orders. English change ringers set
themselves the task of ringing every order exactly once and ending where they
began, with each bell allowed to trade places only with a neighbour from one
row to the next. They call that an **extent**.

This is a small instrument for finding one. The twenty-four rows are the
corners of a solid (a truncated octahedron). You stand on a corner, step to
a neighbour, and the bells ring the row you stepped onto. Ring all
twenty-four and come home.

There are 10,792 ways to do it, 162 of them essentially different, and
eleven that ringers have names for. The page will tell you which one you
found.

Everything runs in the browser. No build step, no dependencies, no server.

## Run it

Open `index.html` through any static web server (it uses ES modules, so
`file://` will not do):

```bash
node tools/serve.mjs
```

and visit <http://localhost:4173/>.

To host on GitHub Pages, serve the repository root. `.nojekyll` is there so
Pages serves the files as they are.

## Play it

- **Step** by clicking a joined corner on the solid, or with the four
  change buttons beneath it (keys `x` `m` `b` `f`).
- **Step back** with the button, `z`, Backspace, or by clicking the corner
  you just left.
- **Ring it** (Space) has the band ring what you have so far, in rhythm.
  **Stand** (Escape) stops them.
- Drag the solid to turn it.
- The line under the changes says how many extents still begin the way you
  have gone. When it says none, step back.

## What is where

| | |
|---|---|
| `index.html`, `css/style.css` | the page |
| `journal.html`, `js/journal.js` | the journal, set as a page |
| `js/rows.js` | the arithmetic: rows, changes, the catalogue of 10,792, the eleven named methods, the solid's coordinates. No DOM. |
| `js/solid.js` | the solid, drawn in SVG, and used as the controller |
| `js/leaf.js` | the rows set down the page with the red and blue lines |
| `js/bell.js` | one bell, struck once, as samples. No audio API. |
| `js/audio.js` | the tower: scheduling strikes on the audio clock |
| `js/atlas.js` | the plate of 162 |
| `js/main.js` | the conductor: state, and keeping the rest in step |
| `test/` | checks for every number the page quotes, and for the bells |
| `tools/serve.mjs` | a static server for local use |
| `tools/probe.mjs` | the throwaway script that tested the idea before anything was built |
| `JOURNAL.md` | how it was made, including what was tried and dropped |

## Check it

```bash
node test/rows.test.mjs
```

```bash
node test/bell.test.mjs
```

```bash
node test/journal.test.mjs
```

The first asserts the figures quoted on the page (10,792; 162; the eleven;
the geometry of the solid). The second measures the synthesised bells,
because the author cannot listen to them. The third checks the small
Markdown reader that sets the journal.

## Sources and credits

- Method names and place notation: the
  [Composition Library](https://complib.org/method/10460).
- Historical records: the
  [Central Council of Church Bell Ringers](https://cccbr.org.uk/peal-performance/?id=5).
- Type: the Fell Types, digitally reproduced by
  [Igino Marini](https://iginomarini.com/fell/), served by Google Fonts. The
  ten digits are EB Garamond, by Georg Duffner and Octavio Pardo.
- Made by Claude.
