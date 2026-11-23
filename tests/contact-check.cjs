// お問い合わせの道の点検 (毎朝の提案①、よしひろさん OK 2026-11-23)。ページは公開も変更もしない、読むだけ。
// 実行: node tests/contact-check.cjs          … ページの中だけを確かめる
//       node tests/contact-check.cjs --live   … Google フォームも読みに行き、質問と必須を確かめる (送信はしない)
const fs = require('fs'); const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const out = []; const ok = (name, cond, detail = '') => out.push({ name, ok: !!cond, detail });

const contact = (html.match(/<section id="contact"[\s\S]*?<\/section>/) || [''])[0];
ok('CONTACT の欄がある', contact);
const form = (contact.match(/<a [^>]*href="(https:\/\/docs\.google\.com\/forms\/[^"]+)"[^>]*>/) || []);
ok('お問い合わせフォームへのリンクがある', form[1]);
ok('フォームは新しいタブで開く', /target="_blank"/.test(form[0] || ''));
ok('フォームのリンクに rel="noopener" がある', /rel="[^"]*noopener/.test(form[0] || ''));
ok('「ご注文は承っておりません」の注記がある', contact.includes('ご注文は承っておりません'));
const external = [...html.matchAll(/<a [^>]*href="https:[^"]+"[^>]*>/g)].map((m) => m[0]);
const bad = external.filter((a) => !/target="_blank"/.test(a) || !/rel="[^"]*noopener/.test(a));
ok('外へのリンクはすべて新しいタブ・noopener', bad.length === 0, bad.length ? `${bad.length} 件が足りない` : `${external.length} 件`);
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]); const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
ok('id が重なっていない', dup.length === 0, dup.join(','));

async function live() {
  // curl を使う (この環境ではネットの出口が curl の設定に従うため)
  const raw = require('child_process').execFileSync('curl', ['-sL', '--max-time', '20', '-w', '\n%{http_code}', form[1]], { encoding: 'utf8', maxBuffer: 32 << 20 });
  const status = raw.slice(raw.lastIndexOf('\n') + 1); const s = raw.slice(0, raw.lastIndexOf('\n'));
  ok('フォームが開ける (200)', status === '200', status);
  const m = s.match(/FB_PUBLIC_LOAD_DATA_ = (.*?);<\/script>/s); if (!m) { ok('フォームの中身が読める', false); return; }
  const d = JSON.parse(m[1]); const qs = d[1][1].map((q) => ({ title: q[1], required: q[4] && q[4][0][2] === 1, choices: q[4] && q[4][0][1] ? q[4][0][1].map((c) => c[0]) : [] }));
  ok('題名に「お問い合わせ」がある', String(d[1][8] || '').includes('お問い合わせ'), d[1][8]);
  for (const t of ['お名前', 'ご用件', '内容']) { const q = qs.find((x) => x.title === t); ok(`「${t}」があり必須`, q && q.required); }
  const kinds = (qs.find((x) => x.title === 'ご用件') || { choices: [] }).choices;
  ok('ご用件にページの「見学・取材・コラボ」がそろっている', ['見学', '取材', 'コラボ'].every((k) => kinds.includes(k)), kinds.join('・'));
}
(async () => {
  if (process.argv.includes('--live')) { try { await live(); } catch (e) { ok('フォームを読みに行けた', false, e.message); } }
  for (const r of out) console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.detail ? ' (' + r.detail + ')' : ''}`);
  const fails = out.filter((r) => !r.ok).length; console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0);
})();
