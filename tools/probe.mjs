// Probe: the space of "extents" on four bells.
// Row = string of 4 bells. Changes: x (swap 12,34), 14 (swap 23), 12 (swap 34), 34 (swap 12)
const CH = { x: [[0,1],[2,3]], '14': [[1,2]], '12': [[2,3]], '34': [[0,1]] };
const names = ['x','14','12','34'];
const apply = (row, c) => { const a = row.split(''); for (const [i,j] of CH[c]) [a[i],a[j]]=[a[j],a[i]]; return a.join(''); };
const R = '1234';
let count = 0; const all = [];
const seen = new Set([R]); const path = [];
(function dfs(row) {
  if (path.length === 23) { for (const c of names) if (apply(row,c)===R) { count++; all.push([...path,c].join('.')); } return; }
  for (const c of names) { const n = apply(row,c); if (seen.has(n)) continue; seen.add(n); path.push(c); dfs(n); path.pop(); seen.delete(n); }
})(R);
console.log('directed extents from rounds:', count);
// periodicity
const per = {};
for (const s of all) { const a = s.split('.'); let p = 24; for (const q of [1,2,3,4,6,8,12]) { let ok = true; for (let i=q;i<24;i++) if (a[i]!==a[i-q]) {ok=false;break;} if (ok) {p=q;break;} } per[p]=(per[p]||0)+1; }
console.log('by period:', per);
// equivalence classes under rotation, reversal, mirror (12<->34)
const mir = {x:'x','14':'14','12':'34','34':'12'};
const canon = (a) => { let best=null; for (const m of [0,1]) for (const r of [0,1]) { let b = a.map(c=>m?mir[c]:c); if (r) b = b.slice().reverse(); for (let k=0;k<24;k++){ const s = b.slice(k).concat(b.slice(0,k)).join('.'); if (best===null||s<best) best=s; } } return best; };
const classes = new Map();
for (const s of all) { const k = canon(s.split('.')); classes.set(k,(classes.get(k)||0)+1); }
console.log('classes under rotation+reversal+mirror:', classes.size);
const rot = new Set(); for (const s of all){ const a=s.split('.'); let best=null; for(let k=0;k<24;k++){const t=a.slice(k).concat(a.slice(0,k)).join('.'); if(best===null||t<best)best=t;} rot.add(best);} console.log('classes under rotation only:', rot.size);
// symmetric treble-hunt methods: a,b,h,l
const res = [];
for (const a of ['x','34']) for (const b of ['x','12']) for (const h of ['14','34']) for (const l of ['14','12']) {
  const lead = [a,'14',b,h,b,'14',a,l]; const seq = [...lead,...lead,...lead];
  let row = R; const s = new Set([R]); let ok = true; for (let i=0;i<24;i++){ row = apply(row,seq[i]); if (i<23 && s.has(row)) {ok=false;break;} s.add(row);} ok = ok && row===R;
  res.push(lead.join('.')+' -> '+(ok?'EXTENT':'no'));
}
console.log(res.join('\n'));
// plain hunt belt check
let row=R; const belt=[R]; for (let i=0;i<7;i++){ row=apply(row, i%2?'14':'x'); belt.push(row);} console.log('plain hunt:', belt.join(' '));
console.log('first:', all[0]); console.log('last:', all[all.length-1]);
