// node test/journal.test.mjs
//
// The journal page sets JOURNAL.md with a small Markdown reader of its own.
// This checks the reader against the constructs the journal uses, and then
// against the journal itself.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { render } from '../js/journal.js';

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed++;
    console.log('  ok   ' + name);
  } catch (e) {
    console.log('  FAIL ' + name);
    console.log(e.message.split('\n').map((l) => '       ' + l).join('\n'));
    process.exitCode = 1;
  }
};

console.log('the reader');
test('headings, paragraphs and rules', () => {
  assert.equal(render('## 3. A thing\n\nOne line\nand another.\n\n---\n'), '<h2>3. A thing</h2>\n<p>One line and another.</p>\n<hr>');
});
test('emphasis, code and links', () => {
  assert.equal(
    render('A *soft* and a **firm** word, `a * b`, and [a link](https://example.org/x).'),
    '<p>A <em>soft</em> and a <strong>firm</strong> word, <code>a * b</code>, and <a href="https://example.org/x" rel="noopener">a link</a>.</p>'
  );
});
test('list items run on over indented lines', () => {
  assert.equal(render('- one\n  still one\n- two\n\nafter'), '<ul><li>one still one</li><li>two</li></ul>\n<p>after</p>');
});
test('numbered lists', () => {
  assert.equal(render('1. **First.** Then\n   more.\n2. Second.\n'), '<ol><li><strong>First.</strong> Then more.</li><li>Second.</li></ol>');
});
test('emphasis may sit inside strong', () => {
  assert.equal(render('**It said "as *Tintinnalogia*"**, a book.'), '<p><strong>It said “as <em>Tintinnalogia</em>”</strong>, a book.</p>');
});
test('tables', () => {
  const html = render('| a | b |\n|---|---|\n| `x` | both |\n');
  assert.equal(html, '<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td><code>x</code></td><td>both</td></tr></tbody></table>');
});
test('straight quotes are curled, except in code', () => {
  assert.equal(
    render(`He said "true" and it's 'so' ("really"), in \`a "b" 'c'\`.`),
    '<p>He said “true” and it’s ‘so’ (“really”), in <code>a &quot;b&quot; \'c\'</code>.</p>'
  );
});
test('markup in the text is shown, not obeyed', () => {
  const html = render('<script>alert(1)</script> and [x](javascript:alert(1))');
  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('href="javascript'));
});

console.log('the journal itself');
const journal = readFileSync(new URL('../JOURNAL.md', import.meta.url), 'utf8');
const html = render(journal.replace(/^# .*\n/, ''));
test('every entry becomes a heading, in order', () => {
  const heads = [...html.matchAll(/<h2>(\d+)\. /g)].map((m) => Number(m[1]));
  assert.ok(heads.length >= 14);
  heads.forEach((n, i) => assert.equal(n, i + 1));
});
test('no Markdown is left showing', () => {
  const text = html.replace(/<code>.*?<\/code>/g, '').replace(/<[^>]+>/g, '');
  assert.ok(!text.includes('*'), 'stray * in: ' + (text.match(/.{0,40}\*.{0,40}/) || [''])[0]);
  assert.ok(!/<p>\d+\. /.test(html), 'a numbered list was set as a paragraph');
  assert.ok(!/\]\(http/.test(text), 'stray link syntax');
  assert.ok(!/^#+ /m.test(text), 'stray heading marks');
  assert.ok(!/^\s*\|/m.test(text), 'stray table row');
});
test('every link goes somewhere over https', () => {
  const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(links.length >= 5);
  for (const l of links) assert.ok(l.startsWith('https://'), l);
});

console.log('\n' + passed + ' passed' + (process.exitCode ? ', SOME FAILED' : ''));
