// The leaf: the rows rung so far, set down the page as ringers write them,
// one row to a line, with a line drawn through the path of a bell. By long
// custom the treble's path is red and the bell you are studying is blue.

import { CHANGES, LENGTH } from './rows.js';

const NS = 'http://www.w3.org/2000/svg';
const make = (name, attrs, parent) => {
  const node = document.createElementNS(NS, name);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(node);
  return node;
};

const CW = 27; // column width
const RH = 23; // row height
const ML = 44; // left margin, where the changes are noted
const MR = 36; // right margin, where rows are counted
const TOP = 20;
export const LEAF_W = ML + 4 * CW + MR;
export const LEAF_H = TOP + (LENGTH + 1) * RH + 6;

const cx = (place) => ML + place * CW + CW / 2;
const cy = (row) => TOP + row * RH;

export class Leaf {
  constructor(svg) {
    this.svg = svg;
    svg.setAttribute('viewBox', `0 0 ${LEAF_W} ${LEAF_H}`);
    svg.setAttribute('width', LEAF_W);
    svg.setAttribute('height', LEAF_H);

    // The page is ruled for twenty-four changes before any are rung.
    const blanks = make('g', { class: 'blanks' }, svg);
    for (let r = 1; r <= LENGTH; r++) {
      for (let p = 0; p < 4; p++) make('circle', { cx: cx(p), cy: cy(r), r: 0.9 }, blanks);
    }

    this.gRules = make('g', { class: 'rules' }, svg);
    this.red = make('path', { class: 'line red' }, svg);
    this.blue = make('path', { class: 'line blue' }, svg);
    this.gNotes = make('g', { class: 'notes' }, svg);
    this.gRows = make('g', { class: 'rows' }, svg);
    this.count = make('text', { class: 'count', x: ML + 4 * CW + 10 }, svg);
    this.mark = make('path', { class: 'mark', d: 'M-5,-4 L1,0 L-5,4 Z' }, svg);

    this.digits = []; // [row][place] -> <text>
    this.shown = 1; // rows already on the page at the last render, for the inking-in
    this.playhead = null;
  }

  // rows: the rows rung, rounds first. changes: what was made between them.
  // blue: which bell the blue line follows. rules: row numbers to rule off under.
  // stagger: seconds between strikes, so a new row inks in as it sounds.
  render({ rows, changes, blue, rules = [], stagger = 0.2, delay = 0 }) {
    this.gRows.replaceChildren();
    this.gNotes.replaceChildren();
    this.gRules.replaceChildren();
    this.digits = [];

    rows.forEach((row, r) => {
      const fresh = r >= this.shown;
      const line = [];
      for (let p = 0; p < 4; p++) {
        const bell = row[p];
        let cls = 'digit';
        if (bell === '1') cls += ' red';
        else if (bell === String(blue)) cls += ' blue';
        if (fresh) cls += ' fresh';
        const t = make('text', { class: cls, x: cx(p), y: cy(r) + 6 }, this.gRows);
        if (fresh) t.style.animationDelay = (delay + (r - this.shown) * 4 * stagger + p * stagger).toFixed(3) + 's';
        t.textContent = bell;
        line.push(t);
      }
      this.digits.push(line);
    });

    changes.forEach((c, i) => {
      const t = make('text', { class: 'note', x: ML - 12, y: cy(i) + RH / 2 + 4.5 }, this.gNotes);
      t.textContent = CHANGES[c].glyph;
    });

    for (const r of rules) {
      make('line', { x1: ML - 2, x2: ML + 4 * CW + 2, y1: cy(r) + RH / 2 + 0.5, y2: cy(r) + RH / 2 + 0.5 }, this.gRules);
    }

    const trace = (bell) =>
      rows.map((row, r) => (r ? 'L' : 'M') + cx(row.indexOf(bell)) + ',' + cy(r)).join(' ');
    this.red.setAttribute('d', rows.length > 1 ? trace('1') : '');
    this.blue.setAttribute('d', rows.length > 1 ? trace(String(blue)) : '');

    const last = rows.length - 1;
    this.count.textContent = last > 0 ? String(last) : '';
    this.count.setAttribute('y', cy(last) + 5.5);

    this.shown = rows.length;
    this.setPlayhead(this.playhead);
  }

  // While the band is ringing: everything after this row and strike is still
  // to come, and is printed faint. null means nothing is being rung.
  setPlayhead(head) {
    this.playhead = head;
    this.digits.forEach((line, r) => {
      line.forEach((t, p) => {
        const due = head !== null && (r > head.row || (r === head.row && p > head.strike));
        t.classList.toggle('due', due);
        t.classList.toggle('struck', head !== null && r === head.row && p === head.strike);
      });
    });
    if (head === null || head.row < 0) {
      this.mark.setAttribute('display', 'none');
    } else {
      this.mark.removeAttribute('display');
      this.mark.setAttribute('transform', `translate(${ML - 30},${cy(Math.min(head.row, this.digits.length - 1))})`);
    }
    this.svg.classList.toggle('playing', head !== null);
  }

  // Forget what was on the page, so the next render inks every row in afresh.
  reset(shown = 1) {
    this.shown = shown;
  }
}
