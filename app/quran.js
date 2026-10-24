// Quran text helpers (Tanzil Uthmani text + page/juz metadata). Pure functions: work in Node (main, selftest) and the renderer.
(function (root) {
  // exactly as in the Tanzil file (verse 1:1), so it can be split from verse 1 of the other suras
  const BASMALA = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';
  const PAGES = 604;

  /** text: the quran-uthmani.txt content, meta: quran-meta.json. Returns a lookup object. */
  function build(text, meta) {
    const verses = [];   // global index -> [sura, aya, text]
    for (const line of String(text).split(/\r?\n/)) {
      if (!line || line[0] === '#') continue;
      const a = line.indexOf('|'), b = line.indexOf('|', a + 1);
      if (a < 0 || b < 0) continue;
      verses.push([Number(line.slice(0, a)), Number(line.slice(a + 1, b)), line.slice(b + 1)]);
    }
    const index = (s, a) => meta.suras[s - 1][3] + a - 1;
    const pageStart = meta.pages.map(([s, a]) => index(s, a));
    const juzStart = meta.juz.map(([s, a]) => index(s, a));
    return { verses, meta, index, pageStart, juzStart };
  }

  // last i with arr[i] <= v (arr sorted)
  function floorIdx(arr, v) { let lo = 0, hi = arr.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (arr[m] <= v) lo = m; else hi = m - 1; } return lo; }

  const clampPage = (p) => Math.min(PAGES, Math.max(1, Math.round(Number(p) || 1)));
  /** verses of a page: [[sura, aya, text], ...] (page N = from pages[N-1] up to before pages[N]) */
  function pageVerses(Q, page) {
    const p = clampPage(page);
    const from = Q.pageStart[p - 1], to = p < PAGES ? Q.pageStart[p] : Q.verses.length;
    return Q.verses.slice(from, to);
  }
  const pageOf = (Q, s, a = 1) => floorIdx(Q.pageStart, Q.index(s, a)) + 1;
  // a juz that starts anywhere on the page counts for that page (page 121 = juz 7)
  const juzOfPage = (Q, page) => { const p = clampPage(page); return floorIdx(Q.juzStart, (p < PAGES ? Q.pageStart[p] : Q.verses.length) - 1) + 1; };
  const surahStartPage = (Q, s) => pageOf(Q, s, 1);
  /** verse text without the basmala that Tanzil puts in front of verse 1 (all suras except 1 and 9) */
  function verseText(s, a, t) {
    if (a === 1 && s !== 1 && s !== 9 && t.startsWith(BASMALA)) return t.slice(BASMALA.length).trim();
    return t;
  }
  /** "2/255" -> one verse, "112" -> the whole sura: {s, from, to, verses} */
  function ref(Q, r) {
    const [s, a] = String(r).split(/[/:]/).map(Number);
    if (!s || s < 1 || s > 114) return null;
    const n = Q.meta.suras[s - 1][1];
    const from = a ? Math.min(n, Math.max(1, a)) : 1, to = a ? from : n;
    return { s, from, to, verses: Q.verses.slice(Q.index(s, from), Q.index(s, to) + 1) };
  }
  /** loose Arabic match for the surah search: no diacritics, one alef, ta marbuta = ha, no "سورة" or "ال" */
  function norm(x) {
    return String(x).replace(/[ً-ٰٟۖ-ۭـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/^\s*سوره\s+/, '').replace(/\s+/g, ' ').trim().replace(/^ال/, '');
  }

  const api = { BASMALA, PAGES, build, pageVerses, pageOf, juzOfPage, surahStartPage, verseText, ref, norm, clampPage };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Quran = api;
})(typeof window !== 'undefined' ? window : globalThis);
