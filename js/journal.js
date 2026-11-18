// Sets JOURNAL.md as a page. The journal is kept as Markdown so it reads
// well in the repository; this turns the small part of Markdown it uses into
// HTML so it also reads well here, whatever a web server decides a .md file is.

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The journal is typed with straight quotes. The Fell types draw a straight
// quote as a closing one, so an opening quote has to be asked for by name.
const quotes = (s) =>
  s
    .replace(/(^|[\s(\[—])"/g, '$1“')
    .replace(/"/g, '”')
    .replace(/(^|[\s(\[—])'/g, '$1‘')
    .replace(/'/g, '’');

// Inline marks.
function inline(text) {
  const kept = [];
  const keep = (html) => `\u0000${kept.push(html) - 1}\u0000`;
  let s = text;
  // Code first, so nothing inside it is read as emphasis or has its quotes curled.
  s = s.replace(/`([^`]+)`/g, (_, code) => keep(`<code>${escape(code)}</code>`));
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, label, url) =>
    keep(`<a href="${escape(url)}" rel="noopener">${escape(quotes(label))}</a>`)
  );
  s = escape(quotes(s));
  // Strong first and as short as it can be, so emphasis may sit inside it.
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => kept[Number(i)]);
}

export function render(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  const blank = (l) => l.trim() === '';

  while (i < lines.length) {
    const line = lines[i];
    if (blank(line)) {
      i++;
    } else if (/^#{1,3} /.test(line)) {
      const level = line.indexOf(' ');
      out.push(`<h${level}>${inline(line.slice(level + 1))}</h${level}>`);
      i++;
    } else if (/^---+$/.test(line.trim())) {
      out.push('<hr>');
      i++;
    } else if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const body = rows.filter((r) => !/^\|[\s:|-]+\|$/.test(r));
      const [head, ...rest] = body;
      out.push(
        '<table><thead><tr>' + cells(head).map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' +
          rest.map((r) => '<tr>' + cells(r).map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
          '</tbody></table>'
      );
    } else if (line.startsWith('- ')) {
      const items = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        let item = lines[i++].slice(2);
        // An item runs on over indented lines.
        while (i < lines.length && /^ {2,}\S/.test(lines[i])) item += ' ' + lines[i++].trim();
        items.push(`<li>${inline(item)}</li>`);
      }
      out.push('<ul>' + items.join('') + '</ul>');
    } else if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        let item = lines[i++].replace(/^\d+\. /, '');
        while (i < lines.length && /^ {2,}\S/.test(lines[i])) item += ' ' + lines[i++].trim();
        items.push(`<li>${inline(item)}</li>`);
      }
      out.push('<ol>' + items.join('') + '</ol>');
    } else {
      let para = line;
      i++;
      while (i < lines.length && !blank(lines[i]) && !/^(#{1,3} |- |\d+\. |\||---+$)/.test(lines[i])) para += ' ' + lines[i++].trim();
      out.push(`<p>${inline(para)}</p>`);
    }
  }
  return out.join('\n');
}

if (typeof document !== 'undefined') {
  const page = document.getElementById('journal');
  fetch('JOURNAL.md')
    .then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.text();
    })
    .then((text) => {
      // The file opens with its own title; the page already has one.
      page.innerHTML = render(text.replace(/^# .*\n/, ''));
    })
    .catch(() => {
      page.innerHTML = '<p>The journal could not be loaded here. It is the file <a href="JOURNAL.md">JOURNAL.md</a> in the repository.</p>';
    });
}
