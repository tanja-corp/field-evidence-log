'use strict';
/* Field Evidence Log — no framework, no external requests. All text goes through text nodes (no innerHTML). */
(function () {
  const FILES = ['config', 'deck', 'entries', 'themes', 'interview', 'questions', 'feedback', 'changelog'];
  const D = {};
  const AREA_OPT = {
    field: '現場作業 (field)', data: 'データ整理 (data)', research: '調査 (research)',
    tools: 'ツール (tools)', team: 'チーム・対話 (team)', reflection: '振り返り (reflection)'
  };
  const EV_OPT = {
    observed: '観察した (observed)', recorded: '記録で確認 (recorded)', 'public-source': '公開資料 (public-source)',
    'my-view': '私の見方 (my-view)', 'to-confirm': '要確認 (to-confirm)'
  };
  const VERDICT_JA = { ok: 'OK', revise: '直す', hold: '保留' };
  const FACT_HELP = { '✅': '確定', '⚠️': '要確認', '💭': '構想・進行中', '⏸': '停止' };
  const NAV = [
    ['overview', '概要'], ['story', '構成と時間'], ['log', '記録'], ['skills', '学び'],
    ['interview', '面接素材'], ['add', '入力する'], ['how', '進め方']
  ];

  /* ---------- helpers ---------- */
  function h(tag, attrs) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v == null) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of Array.prototype.slice.call(arguments, 2).flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  const $ = (s, r) => (r || document).querySelector(s);
  const safeUrl = u => (/^https?:\/\/\S+$/.test(u || '') ? u : null);
  const enc = encodeURIComponent;
  const min1 = s => (s / 60).toFixed(1);
  const chip = (text, cls, title) => h('span', { class: 'chip ' + (cls || ''), title }, text);

  function issueUrl(template, fields) {
    const c = D.config;
    const q = ['template=' + enc(template)];
    for (const [k, v] of Object.entries(fields)) if (v) q.push(k + '=' + enc(String(v).slice(0, 1500)));
    return `https://github.com/${c.owner}/${c.repo}/issues/new?${q.join('&')}`;
  }
  const fbUrl = (target, verdictJa, comment) => issueUrl('feedback.yml', {
    title: `[Feedback] ${target} ${verdictJa}`, target, verdict: verdictJa, comment: comment || ''
  });

  async function copyText(text, btn) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = h('textarea', { 'aria-hidden': 'true', style: 'position:fixed;left:-999px' });
      ta.value = text; document.body.append(ta); ta.select();
      try { document.execCommand('copy'); } catch (e2) { /* ignore */ }
      ta.remove();
    }
    const old = btn.textContent; btn.textContent = 'コピーしました';
    setTimeout(() => { btn.textContent = old; }, 1600);
  }

  const latestFb = target => D.feedback.filter(f => f.target === target)
    .sort((a, b) => (a.created < b.created ? 1 : -1))[0];
  const answered = q => !!latestFb(q.id);

  function fbButtons(target, small) {
    const cls = 'btn' + (small ? ' sm' : '');
    return h('div', { class: 'btn-row' },
      h('a', { class: cls, href: fbUrl(target, 'OK'), target: '_blank', rel: 'noopener' }, 'OK'),
      h('a', { class: cls, href: fbUrl(target, '直す'), target: '_blank', rel: 'noopener' }, '直す'),
      h('a', { class: cls, href: fbUrl(target, '保留'), target: '_blank', rel: 'noopener' }, '保留'));
  }

  function statusChip(slide) {
    const f = latestFb(slide.id);
    if (f) return chip(VERDICT_JA[f.verdict], f.verdict === 'ok' ? 'ok' : f.verdict === 'revise' ? 'accent' : 'mint', f.comment || '');
    if (slide.status === 'needs-input') return chip('入力待ち', 'warn');
    return chip('未確認', '');
  }

  function missingBox(list) {
    if (!list || !list.length) return null;
    return h('div', { class: 'missing' }, h('strong', {}, '足りない材料'), h('ul', {}, list.map(m => h('li', {}, m))));
  }

  /* ---------- state ---------- */
  const state = { group: 'all', needs: false, area: 'all', ev: 'all', status: 'all', use: 'all', theme: 'all', q: '' };
  const panels = {};

  /* ---------- overview ---------- */
  function buildOverview() {
    const c = D.config, slides = D.deck.slides;
    const openQ = D.questions.filter(q => !answered(q));
    const missingCount = D.entries.filter(e => e.status !== 'confirmed')
      .reduce((n, e) => n + (e.missing || []).length, 0);
    const needInput = slides.filter(s => s.status === 'needs-input' && !latestFb(s.id)).length;
    const tag = t => D.entries.filter(e => e.fact_tag === t).length;
    const main = slides.filter(s => s.group !== 'backup');
    const total = main.reduce((n, s) => n + s.seconds, 0);

    const root = h('section', { class: 'panel', id: 'p-overview' },
      h('h2', {}, 'いまの状況'),
      h('p', { class: 'lede' }, c.purpose_ja),
      h('div', { class: 'tiles' },
        tile(D.entries.length, '記録（✅' + tag('✅') + ' ⚠️' + tag('⚠️') + ' 💭' + tag('💭') + '）'),
        tile(main.length + '＋' + (slides.length - main.length), 'スライド（本編＋補足）'),
        tile(min1(total) + '分', '読み上げの目安（本編）'),
        tile(openQ.length, '答えてほしい問い'),
        tile(missingCount, '足りない材料'),
        tile(needInput, '入力待ちのスライド')),
      h('h3', { class: 'section-gap' }, 'いま答えてほしいこと'),
      h('p', { class: 'muted small' }, '答えは、押したボタンから開くGitHubのフォームに書く。送ると数分でここに反映される。'),
      h('div', { class: 'grid' }, openQ.slice(0, 6).map(questionCard)),
      openQ.length > 6 ? h('p', { class: 'small muted' }, `ほかに${openQ.length - 6}件。「構成と時間」「記録」から見られる。`) : null,
      h('h3', { class: 'section-gap' }, '予定'),
      h('div', { class: 'grid' }, c.milestones.map(m => h('div', { class: 'card' },
        h('strong', {}, m.label),
        h('span', { class: m.state === 'fixed' ? 'chip ok' : 'chip warn' }, m.date ? m.date : '未確定'),
        m.note ? h('span', { class: 'muted small' }, m.note) : null))),
      h('h3', { class: 'section-gap' }, '最近の更新'),
      D.changelog.map(ch => h('div', { class: 'card', style: 'margin-bottom:10px' },
        h('strong', {}, `${ch.date}　${ch.title}`),
        h('ul', { class: 'small', style: 'margin:4px 0 0;padding-left:1.2em' }, ch.items.map(i => h('li', {}, i))))));
    return root;

    function tile(n, l) { return h('div', { class: 'tile' }, h('div', { class: 'n' }, n), h('div', { class: 'l' }, l)); }
  }

  function questionCard(q) {
    const f = latestFb(q.id);
    return h('div', { class: 'card', id: 'q-' + q.id },
      h('div', { class: 'chips' }, chip(q.id, 'mint'), chip(q.topic, ''), f ? chip('回答あり', 'ok') : chip('未回答', 'warn')),
      h('strong', {}, q.text_ja),
      h('span', { class: 'muted small' }, q.why_ja),
      f && f.comment ? h('div', { class: 'missing' }, h('strong', {}, '回答'), h('div', {}, f.comment)) : null,
      h('div', { class: 'btn-row' },
        h('a', { class: 'btn sm primary', href: fbUrl(q.id, 'OK'), target: '_blank', rel: 'noopener' }, f ? '回答を更新' : '回答する')));
  }

  /* ---------- story ---------- */
  function buildStory() {
    const deck = D.deck, m = deck.meta;
    const main = deck.slides.filter(s => s.group !== 'backup');
    const total = main.reduce((n, s) => n + s.seconds, 0);
    const core = main.filter(s => s.core);
    const coreTotal = core.reduce((n, s) => n + s.seconds, 0);

    const bar = h('div', { class: 'pace-bar', role: 'group', 'aria-label': '本編の読み上げ時間の配分' });
    const labels = h('div', { class: 'pace-labels', 'aria-hidden': 'true' });
    main.forEach(s => {
      const style = `flex:${s.seconds} 0 0`;
      bar.append(h('button', {
        type: 'button', class: 'seg-' + s.group, style,
        'aria-label': `${s.id} ${s.title} ${s.seconds}秒`, title: `${s.id} ${s.title}（約${s.seconds}秒）`,
        onclick: () => { const t = $('#slide-' + s.id); if (t) { t.scrollIntoView({ block: 'center' }); t.focus({ preventScroll: true }); } }
      }));
      labels.append(h('span', { style }, s.id, h('span', { class: 'sec' }, s.seconds + '秒')));
    });
    const legend = h('div', { class: 'legend' },
      [['field', '現場', 'var(--s1)'], ['research', '調査', 'var(--s2)'], ['tools', 'ツール', 'var(--s3)'], ['frame', '導入・まとめ', 'var(--sN)']]
        .map(([, label, col]) => h('span', {}, h('i', { style: 'background:' + col }), label)));

    const groupBtns = [['all', 'すべて']].concat(Object.entries(deck.groups).map(([k, v]) => [k, v.label]))
      .map(([k, label]) => h('button', {
        type: 'button', class: 'fbtn', 'aria-pressed': String(state.group === k),
        onclick: () => { state.group = k; renderSlides(); syncPressed(groupWrap, k); }, 'data-k': k
      }, label));
    const groupWrap = h('div', { class: 'grp' }, h('span', { class: 'lbl muted small' }, '種類'), groupBtns);
    const needsBtn = h('button', {
      type: 'button', class: 'fbtn', 'aria-pressed': 'false',
      onclick: e => { state.needs = !state.needs; e.currentTarget.setAttribute('aria-pressed', String(state.needs)); renderSlides(); }
    }, '入力待ちだけ');
    const list = h('div', { class: 'grid' });

    function renderSlides() {
      list.replaceChildren(...deck.slides
        .filter(s => (state.group === 'all' || s.group === state.group) &&
          (!state.needs || (s.status === 'needs-input' && !latestFb(s.id))))
        .map(slideCard));
    }

    const root = h('section', { class: 'panel', id: 'p-story' },
      h('h2', {}, 'Admin Meetingの構成と時間'),
      h('p', { class: 'lede' }, `${m.audience_ja} ファイル：${m.file_hint}（${m.version}、${m.updated}）`),
      h('div', { class: 'warnbox' }, m.time_slot_ja),
      h('h3', {}, `本編の読み上げ時間：約${min1(total)}分`),
      h('div', { class: 'pace' }, bar, labels), legend,
      h('p', { class: 'core-line' }, `時間が足りないときは、コアの${core.length}枚（${core.map(s => s.id).join('・')}）だけで約${min1(coreTotal)}分。現場の4件はS02の一覧で済ませられる。`),
      h('p', { class: 'muted small' }, m.title_note_ja),
      h('div', { class: 'filters section-gap' }, groupWrap, h('div', { class: 'grp' }, needsBtn)),
      list,
      h('h3', { class: 'section-gap' }, '原本のスライドから、どう変えたか'),
      h('p', { class: 'muted small' }, '残した・分けた・動かした・削ったものの一覧。'),
      h('div', { style: 'overflow-x:auto' }, h('table', { class: 'map' },
        h('thead', {}, h('tr', {}, h('th', {}, '原本'), h('th', {}, '新しい番号'), h('th', {}, '扱い'), h('th', {}, '理由・メモ'))),
        h('tbody', {}, deck.deck_map.map(r => h('tr', {},
          h('td', {}, `${r.orig}　${r.orig_title}`),
          h('td', {}, r.to.length ? r.to.join('、') : '—'),
          h('td', {}, { kept: '残した', replaced: '置き換えた', split: '2枚に分けた', moved: '動かした', dropped: '削った', restored: '復元した' }[r.action] || r.action),
          h('td', {}, r.note_ja))))))
    );
    renderSlides();
    return root;
  }

  function syncPressed(wrap, key) {
    wrap.querySelectorAll('.fbtn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === key)));
  }

  function slideCard(s) {
    const tags = D.deck.tag_labels;
    return h('article', { class: 'card', id: 'slide-' + s.id, tabindex: '-1' },
      h('h3', {}, h('span', { class: 'no' }, s.id), h('span', { class: 'en' }, s.title)),
      h('div', { class: 'chips' },
        chip(D.deck.groups[s.group].label, 'dot g-' + s.group), chip(s.seconds + '秒', ''), s.core ? chip('コア', 'mint') : null,
        statusChip(s), (s.tags || []).map(t => chip(tags[t] || t, ''))),
      s.takeaway ? h('div', { class: 'take en' }, s.takeaway) : null,
      h('div', { class: 'purpose' }, s.purpose_ja),
      s.decision_ja ? h('div', { class: 'small' }, h('span', { class: 'muted' }, '役立つ判断：'), s.decision_ja) : null,
      s.blocker_ja ? h('div', { class: 'missing' }, h('strong', {}, '決めてほしいこと'), h('div', {}, s.blocker_ja)) : null,
      h('details', {}, h('summary', {}, 'スライドの中身（英語）'),
        h('ul', { class: 'en' }, s.lines.map(l => h('li', {}, l))),
        s.asks && s.asks.length ? h('p', { class: 'small' }, h('strong', {}, '会議で聞くこと：'), h('span', { class: 'en' }, s.asks.join(' / '))) : null),
      latestFb(s.id) && latestFb(s.id).comment ? h('div', { class: 'missing' }, h('strong', {}, 'コメント'), h('div', {}, latestFb(s.id).comment)) : null,
      fbButtons(s.id, true));
  }

  /* ---------- log ---------- */
  function buildLog() {
    const cfg = D.config;
    const list = h('div', { class: 'grid' });
    const count = h('p', { class: 'muted small' });
    const themeNote = h('div', { class: 'chips' });
    const search = h('input', { type: 'search', placeholder: '語で絞り込む', 'aria-label': '語で絞り込む', oninput: e => { state.q = e.target.value.trim(); render(); } });

    function group(label, key, opts) {
      const wrap = h('div', { class: 'grp' }, h('span', { class: 'lbl muted small' }, label));
      [['all', 'すべて']].concat(Object.entries(opts)).forEach(([k, v]) => wrap.append(h('button', {
        type: 'button', class: 'fbtn', 'data-k': k, 'aria-pressed': String(state[key] === k),
        onclick: () => { state[key] = k; syncPressed(wrap, k); render(); }
      }, v)));
      return wrap;
    }
    const filters = h('div', { class: 'filters' },
      group('分野', 'area', cfg.area_labels), group('根拠', 'ev', cfg.evidence_labels),
      group('状況', 'status', cfg.status_labels), group('使う場面', 'use', cfg.use_labels), search);

    function render() {
      const q = state.q.toLowerCase();
      const items = D.entries.filter(e =>
        (state.area === 'all' || e.area === state.area) && (state.ev === 'all' || e.evidence_level === state.ev) &&
        (state.status === 'all' || e.status === state.status) && (state.use === 'all' || (e.uses || []).includes(state.use)) &&
        (state.theme === 'all' || (e.themes || []).includes(state.theme)) &&
        (!q || JSON.stringify(e).toLowerCase().includes(q)));
      count.textContent = `${items.length}件 / 全${D.entries.length}件`;
      list.replaceChildren(...items.map(entryCard));
      themeNote.replaceChildren();
      if (state.theme !== 'all') {
        const t = D.themes.find(x => x.id === state.theme);
        themeNote.append(chip('学び：' + (t ? t.name_ja : state.theme), 'accent'),
          h('button', { type: 'button', class: 'fbtn', onclick: () => { state.theme = 'all'; render(); } }, '解除'));
      }
    }
    const root = h('section', { class: 'panel', id: 'p-log' },
      h('h2', {}, '記録'),
      h('p', { class: 'lede' }, '経験を1件ずつ、状況・したこと・分かったこと・学びの順に残す。「足りない材料」は、役割と数字を確かめるための宿題。'),
      h('div', { class: 'btn-row' },
        h('a', { class: 'btn primary', href: issueUrl('entry.yml', { title: '[Entry] ', date: new Date().toISOString().slice(0, 7) }), target: '_blank', rel: 'noopener' }, '記録を追加'),
        h('a', { class: 'btn', href: '#/add' }, '入力の方法を見る')),
      filters, themeNote, count, list);
    root._render = render;
    render();
    return root;
  }

  function entryCard(e) {
    const cfg = D.config;
    const src = (e.sources || []).map(s => {
      const u = safeUrl(s.url);
      return h('li', {}, u ? h('a', { href: u, target: '_blank', rel: 'noopener' }, s.label) : s.label);
    });
    const body = [['状況・課題', e.situation], ['自分がしたこと', e.action], ['分かったこと・成果', e.result], ['学び・次にすること', e.learning]]
      .filter(([, v]) => v);
    return h('article', { class: 'card', id: 'entry-' + e.id },
      h('h3', {}, h('span', { class: 'no' }, e.id), e.title),
      e.title_en ? h('div', { class: 'muted small en' }, e.title_en) : null,
      h('div', { class: 'chips' },
        chip(e.date, ''), chip(cfg.area_labels[e.area] || e.area, 'mint'), chip(cfg.evidence_labels[e.evidence_level] || e.evidence_level, ''),
        chip(e.fact_tag + ' ' + (FACT_HELP[e.fact_tag] || ''), e.fact_tag === '✅' ? 'ok' : 'warn', '就活用の台帳と同じ確度タグ'),
        chip(cfg.status_labels[e.status] || e.status, ''),
        (e.uses || []).map(u => chip(cfg.use_labels[u] || u, ''))),
      h('details', {}, h('summary', {}, '状況・したこと・分かったこと'),
        h('dl', { class: 'kv' }, body.map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]))),
      missingBox(e.missing),
      src.length ? h('ul', { class: 'small', style: 'margin:0;padding-left:1.2em' }, src) : null,
      (e.themes && e.themes.length) || (e.deck_slides && e.deck_slides.length) ? h('div', { class: 'chips' },
        (e.themes || []).map(t => { const th = D.themes.find(x => x.id === t); return h('a', { class: 'chip accent', href: '#/log?theme=' + t, style: 'text-decoration:none' }, th ? th.name_ja : t); }),
        (e.deck_slides || []).map(s => h('a', { class: 'chip', href: '#/story', style: 'text-decoration:none' }, s))) : null,
      e.note ? h('div', { class: 'muted small' }, '注：' + e.note) : null,
      h('div', { class: 'btn-row' }, fbButtons(e.id, true)));
  }

  /* ---------- skills ---------- */
  function buildSkills() {
    return h('section', { class: 'panel', id: 'p-skills' },
      h('h2', {}, '学び'),
      h('p', { class: 'lede' }, 'いくつかの記録に共通して出てくる学びを、テーマにまとめた。面接では、テーマから入って記録で裏付ける。'),
      h('div', { class: 'grid' }, D.themes.map(t => {
        const es = D.entries.filter(e => (e.themes || []).includes(t.id));
        return h('article', { class: 'card', id: 'theme-' + t.id },
          h('h3', {}, t.name_ja), h('div', { class: 'muted small en' }, t.name_en),
          h('div', {}, t.statement_ja),
          h('div', { class: 'small' }, h('span', { class: 'muted' }, '面接での使いどころ：'), t.interview_ja),
          h('div', { class: 'small' }, h('span', { class: 'muted' }, '次にすること：'), t.next_ja),
          h('div', { class: 'chips' }, es.map(e => h('a', { class: 'chip mint', href: '#/log?theme=' + t.id, style: 'text-decoration:none' }, e.id + ' ' + e.title))));
      })));
  }

  /* ---------- interview ---------- */
  function buildInterview() {
    const iv = D.interview, cfg = D.config;
    return h('section', { class: 'panel', id: 'p-interview' },
      h('h2', {}, '面接・ガクチカの素材'),
      h('p', { class: 'lede' }, '記録から起こした下書き。まだ数字と自分の役割が未確認なので、確度は⚠️のまま。'),
      h('div', { class: 'warnbox' }, iv.rule_ja),
      h('div', { class: 'grid' }, iv.stories.map(st => h('article', { class: 'card span', id: 'story-' + st.id },
        h('h3', {}, h('span', { class: 'no' }, st.id), st.title_ja),
        h('div', { class: 'chips' },
          chip(st.fact_tag + ' ' + (FACT_HELP[st.fact_tag] || ''), st.fact_tag === '✅' ? 'ok' : 'warn'),
          st.for.map(u => chip(cfg.use_labels[u] || u, 'mint')),
          st.question_types.map(q => chip(q, '')),
          st.entries.map(e => h('a', { class: 'chip', href: '#/log', style: 'text-decoration:none' }, e))),
        h('div', { class: 'draft' }, st.draft_ja),
        missingBox(st.missing),
        h('div', { class: 'btn-row' },
          h('button', { type: 'button', class: 'btn sm', onclick: e => copyText(st.draft_ja, e.currentTarget) }, '下書きをコピー'),
          fbButtons(st.id, true))))));
  }

  /* ---------- add ---------- */
  function buildAdd() {
    const f = {};
    const field = (id, label, el, full) => h('div', { class: 'field' + (full ? ' full' : '') }, h('label', { for: id }, label), el);
    const inp = (id, ph, val) => { f[id] = h('input', { type: 'text', id, placeholder: ph || '', value: val || '' }); return f[id]; };
    const ta = (id, ph) => { f[id] = h('textarea', { id, placeholder: ph || '' }); return f[id]; };
    const sel = (id, opts) => { f[id] = h('select', { id }, Object.entries(opts).map(([k, v]) => h('option', { value: k }, v))); return f[id]; };
    const url = h('a', { class: 'btn primary', target: '_blank', rel: 'noopener', href: '#' }, 'GitHubのフォームで開く');
    const warn = h('p', { class: 'small muted' });
    function refresh() {
      const u = issueUrl('entry.yml', {
        title: '[Entry] ' + f.title.value, date: f.date.value, entry_title: f.title.value, area: AREA_OPT[f.area.value],
        situation: f.situation.value, action: f.action.value, result: f.result.value, learning: f.learning.value,
        evidence_level: EV_OPT[f.ev.value], source: f.source.value
      });
      url.setAttribute('href', u);
      warn.textContent = u.length > 7000 ? '文章が長すぎてリンクが開けない可能性がある。短くするか、Claudeに渡す。' : '';
    }
    const form = h('div', { class: 'formgrid', oninput: refresh, onchange: refresh },
      field('date', '日付（YYYY-MM か YYYY-MM-DD）', inp('date', '2026-10', new Date().toISOString().slice(0, 10))),
      field('title', 'タイトル（何をしたか）', inp('title', '')),
      field('area', '分野', sel('area', D.config.area_labels)),
      field('ev', '根拠の種類', sel('ev', D.config.evidence_labels)),
      field('situation', '状況・課題', ta('situation'), true),
      field('action', '自分がしたこと', ta('action'), true),
      field('result', '分かったこと・成果（数字は単位と期間つき）', ta('result'), true),
      field('learning', '学び・次にすること', ta('learning'), true),
      field('source', '出典（URLか資料名）', inp('source', ''), true));
    refresh();

    const promptAdd = '記録を追加して。\n日付：\n分野：（現場作業／データ整理／調査／ツール／チーム／振り返り）\nしたこと：\n分かったこと（数字は単位と期間つき）：\n出典：\n自分の役割：（設計／作業／観察 のどれか）\n※公開ページなので、個人名・取引先名・金額は書かない。';
    const promptDeck = 'ダッシュボードの記録をもとに、Admin Meetingの資料（または最終成果発表の構成）を更新して。足りない材料があれば先に聞いて。';
    const codeRow = (t, label) => h('div', {}, h('div', { class: 'codebox' }, t),
      h('div', { class: 'btn-row', style: 'margin-top:6px' }, h('button', { type: 'button', class: 'btn sm', onclick: e => copyText(t, e.currentTarget) }, label)));

    return h('section', { class: 'panel', id: 'p-add' },
      h('h2', {}, '入力する'),
      h('p', { class: 'lede' }, '3つの入れ方がある。いちばん楽なものでよい。どれで入れても、同じ記録の形に整う。'),
      h('ol', { class: 'steps' },
        h('li', {}, h('strong', {}, 'A　このページのフォーム'), 'スマホからでも入れられる。送ると自動で記録され、1〜2分でこのページに出る。'),
        h('li', {}, h('strong', {}, 'B　Claudeに話す'), '箇条書きでかまわない。Claudeが形式にそろえ、足りない材料を聞き返し、資料にも反映する。'),
        h('li', {}, h('strong', {}, 'C　ファイルを直接直す'), 'data/entries.json を編集して push。変更のたびに自動で検査される。')),
      h('div', { class: 'warnbox' }, 'このページは公開されている。個人名、取引先名、金額、社内の非公開の情報は書かない。迷ったら、数字を丸めるか、「あとで確認」と書く。'),
      h('h3', { class: 'section-gap' }, 'A　フォームから入れる'),
      h('p', { class: 'muted small' }, '入力した内容は、リンクの先のGitHubのフォームに引き継がれる。そこで「Submit new issue」を押すと記録される。'),
      form, h('div', { class: 'btn-row', style: 'margin-top:12px' }, url), warn,
      h('h3', { class: 'section-gap' }, 'B　Claudeに頼む文面'),
      codeRow(promptAdd, '記録の依頼文をコピー'),
      h('div', { style: 'height:12px' }),
      codeRow(promptDeck, '資料更新の依頼文をコピー'));
  }

  /* ---------- how ---------- */
  function buildHow() {
    const c = D.config;
    const repo = `https://github.com/${c.owner}/${c.repo}`;
    return h('section', { class: 'panel', id: 'p-how' },
      h('h2', {}, '進め方'),
      h('p', { class: 'lede' }, '入れる、整える、見せる、返す、直す。この5つを回す。内容は増える前提で、足りない材料を見えるようにしている。'),
      h('ol', { class: 'steps' },
        h('li', {}, h('strong', {}, '入れる'), '経験を1件、フォームかClaudeへ。粗くてよい。'),
        h('li', {}, h('strong', {}, '整える'), 'Claudeが状況・したこと・分かったこと・学びにそろえ、足りない材料を挙げる。'),
        h('li', {}, h('strong', {}, '見せる'), 'このページで、構成・記録・学び・面接素材として見られる。'),
        h('li', {}, h('strong', {}, '返す'), 'スライドごと・問いごとに、OK／直す／保留とコメントを返す。'),
        h('li', {}, h('strong', {}, '直す'), '返事を読み、資料と記録を直して、更新を履歴に残す。')),
      h('h3', { class: 'section-gap' }, '確度のルール（就活の台帳と同じ）'),
      h('p', {}, c.fact_tag_note),
      h('p', { class: 'small muted' }, '記録の確度は、数字・出典・自分の役割がそろったら⚠️から✅に上げる。上げるのは本人の確認後。scripts/export_facts.py で、台帳に貼る形の候補が出る。'),
      h('h3', { class: 'section-gap' }, '公開ページで守ること'),
      h('ul', {}, ['個人名、取引先名、金額、社内の非公開の情報は書かない', '数字は公開資料のものを使い、出典をつける', '自分の見方と事実を分けて書く（根拠の種類で選ぶ）', '同僚の成果は、自分の役割が確認できるまで自分の実績にしない'].map(t => h('li', {}, t))),
      h('p', { class: 'small muted' }, '検索に出ないように設定しているが、URLを知っている人は誰でも読める。'),
      h('h3', { class: 'section-gap' }, '仕組み'),
      h('p', { class: 'small' }, 'データは data/ のJSON。フォームの送信（Issue）を、GitHub Actionsが検査してJSONに追記し、サイトを更新する。リポジトリの持ち主以外のIssueは取り込まない。'),
      h('div', { class: 'btn-row' },
        h('a', { class: 'btn sm', href: repo, target: '_blank', rel: 'noopener' }, 'リポジトリ'),
        h('a', { class: 'btn sm', href: repo + '/issues', target: '_blank', rel: 'noopener' }, '送信の履歴（Issues）'),
        h('a', { class: 'btn sm', href: repo + '/actions', target: '_blank', rel: 'noopener' }, '更新の状況（Actions）')));
  }

  /* ---------- router ---------- */
  function route() {
    const raw = (location.hash.replace(/^#\/?/, '') || 'overview');
    const [name, qs] = raw.split('?');
    const key = panels[name] ? name : 'overview';
    const params = new URLSearchParams(qs || '');
    if (key === 'log') { state.theme = params.get('theme') || state.theme; }
    Object.entries(panels).forEach(([k, p]) => { p.hidden = k !== key; });
    $('#nav').querySelectorAll('a').forEach(a => {
      if (a.dataset.k === key) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (key === 'log' && panels.log._render) panels.log._render();
    document.title = (NAV.find(n => n[0] === key) || [0, ''])[1] + '｜Field Evidence Log';
    window.scrollTo(0, 0);
  }

  function boot() {
    $('#subtitle').textContent = D.config.subtitle;
    $('#nav').append(...NAV.map(([k, label]) => h('a', { href: '#/' + k, 'data-k': k }, label)));
    const main = $('#main');
    main.replaceChildren();
    panels.overview = buildOverview(); panels.story = buildStory(); panels.log = buildLog(); panels.skills = buildSkills();
    panels.interview = buildInterview(); panels.add = buildAdd(); panels.how = buildHow();
    Object.values(panels).forEach(p => { p.hidden = true; main.append(p); });
    $('#foot-meta').textContent = `データ：記録${D.entries.length}件・スライド${D.deck.slides.length}枚・フィードバック${D.feedback.length}件　／　構成 ${D.deck.meta.version}（${D.deck.meta.updated}）`;
    window.addEventListener('hashchange', route);
    route();
  }

  /* theme toggle (viewer convenience only; works without storage) */
  (function () {
    const root = document.documentElement;
    try { const s = localStorage.getItem('fel-theme'); if (s) root.setAttribute('data-theme', s); } catch (e) { /* ignore */ }
    $('#theme').addEventListener('click', () => {
      const dark = (root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
      const next = dark ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('fel-theme', next); } catch (e) { /* ignore */ }
    });
  })();

  Promise.all(FILES.map(f => fetch(`data/${f}.json`, { cache: 'no-store' }).then(r => {
    if (!r.ok) throw new Error(`${f}.json (${r.status})`);
    return r.json();
  }).then(j => { D[f] = j; }))).then(boot).catch(err => {
    const m = $('#main');
    m.replaceChildren(h('p', { class: 'warnbox' }, 'データを読み込めませんでした：' + err.message + '。ローカルで開く場合は、フォルダで「python -m http.server」を実行して http://localhost:8000 を開く。'));
  });
})();
