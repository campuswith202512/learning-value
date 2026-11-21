(function () {
  const DATA = window.LEARNING_DATA;
  const AXES = DATA.axes;
  const COLORS = DATA.seriesColors;

  // Deep-clone segments so simulator can edit scores and reset cleanly
  const initialScoresMap = {};
  DATA.segments.forEach(seg => {
    initialScoresMap[seg.id] = [...seg.scores];
  });

  const state = {
    selectedIds: ['worker_2030', 'worker_4050'],
    activePreset: 'worker_split',
    focusedAxis: null,
    activeDetailId: 'worker_2030',
    editorOpen: false,
    editorSegmentId: 'worker_2030',
    sortKey: 'stageOrder',
    sortDir: 'asc'
  };

  function getSegment(id) {
    return DATA.segments.find(s => s.id === id);
  }

  function getColorForSelected(id) {
    const idx = state.selectedIds.indexOf(id);
    return idx >= 0 ? COLORS[idx % COLORS.length] : null;
  }

  function polarToCartesian(cx, cy, r, angleRad) {
    return {
      x: cx + r * Math.cos(angleRad),
      y: cy + r * Math.sin(angleRad)
    };
  }

  // ---------- 1. Main Radar SVG ----------
  function buildRadarSVG(options) {
    const {
      width = 540,
      height = 385,
      cx = 270,
      cy = 195,
      maxR = 126,
      labelOffset = 20,
      fontSize = 13,
      ids = [],
      interactive = true,
      singleColor = null
    } = options;

    const levels = 5;
    const n = AXES.length;
    let svg = '';

    // Concentric polygons
    for (let lvl = 1; lvl <= levels; lvl++) {
      const r = (maxR / levels) * lvl;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
        const p = polarToCartesian(cx, cy, r, angle);
        pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
      }
      const isOuter = lvl === levels;
      svg += `<polygon points="${pts.join(' ')}" fill="none" stroke="var(--grid-stroke)" stroke-width="${isOuter ? 1.3 : 0.85}" stroke-dasharray="${isOuter ? '' : '3,3'}" opacity="${isOuter ? 0.95 : 0.65}" />`;
    }

    // Axis spokes
    for (let i = 0; i < n; i++) {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
      const p = polarToCartesian(cx, cy, maxR, angle);
      const isFocused = interactive && state.focusedAxis === i;
      svg += `<line x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="${isFocused ? 'var(--primary)' : 'var(--grid-stroke)'}" stroke-width="${isFocused ? 2.2 : 0.95}" opacity="${isFocused ? 0.95 : 0.75}" />`;
    }

    // Scale labels
    if (interactive) {
      for (let lvl = 1; lvl <= levels; lvl++) {
        const y = cy - (maxR / levels) * lvl;
        svg += `<text x="${cx + 6}" y="${y + 4}" font-size="11" fill="var(--text-soft)" font-weight="600">${lvl}</text>`;
      }
    }

    // Polygons
    ids.forEach((id, sIdx) => {
      const seg = getSegment(id);
      if (!seg) return;
      const c = singleColor || COLORS[sIdx % COLORS.length];
      const pts = seg.scores.map((val, i) => {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
        const r = (val / 5) * maxR;
        const p = polarToCartesian(cx, cy, r, angle);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      });

      svg += `<polygon class="radar-poly" points="${pts.join(' ')}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="${interactive ? 2.5 : 2}" stroke-linejoin="round" />`;

      seg.scores.forEach((val, i) => {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
        const r = (val / 5) * maxR;
        const p = polarToCartesian(cx, cy, r, angle);
        const radius = interactive ? (state.focusedAxis === i ? 5.5 : 3.8) : 2.5;
        svg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${radius}" fill="${c.stroke}" stroke="var(--surface)" stroke-width="${interactive ? 1.4 : 1}" />`;
      });
    });

    // Axis labels
    for (let i = 0; i < n; i++) {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
      const p = polarToCartesian(cx, cy, maxR + labelOffset, angle);
      let anchor = 'middle';
      let dx = 0;
      if (Math.cos(angle) > 0.25) { anchor = 'start'; dx = -2; }
      else if (Math.cos(angle) < -0.25) { anchor = 'end'; dx = 2; }
      const dy = Math.sin(angle) < -0.7 ? -4 : (Math.sin(angle) > 0.7 ? 12 : 4);
      const isFocused = interactive && state.focusedAxis === i;
      const cls = interactive ? 'radar-axis-label' : '';
      svg += `<text class="${cls}" data-axis="${i}" x="${(p.x + dx).toFixed(1)}" y="${(p.y + dy).toFixed(1)}" text-anchor="${anchor}" font-size="${fontSize}" font-weight="${isFocused ? '800' : '600'}" fill="${isFocused ? 'var(--primary)' : 'var(--text)'}">${AXES[i].label}</text>`;
    }

    return svg;
  }

  function renderMainRadar() {
    const svgEl = document.getElementById('main-radar-svg');
    svgEl.innerHTML = buildRadarSVG({
      ids: state.selectedIds,
      interactive: true
    });

    svgEl.querySelectorAll('.radar-axis-label').forEach(el => {
      el.addEventListener('click', () => {
        const idx = Number(el.getAttribute('data-axis'));
        state.focusedAxis = state.focusedAxis === idx ? null : idx;
        renderMainRadar();
        renderAxisFocusBar();
      });
    });
  }

  function renderAxisFocusBar() {
    const nameEl = document.getElementById('axis-focus-name');
    const hintEl = document.getElementById('axis-focus-hint');
    const descEl = document.getElementById('axis-focus-desc');
    const chipsEl = document.getElementById('axis-score-chips');

    if (state.focusedAxis === null) {
      nameEl.textContent = '各項目ラベルをクリックして詳細を確認';
      hintEl.textContent = '5段階評価（1.0〜5.0）';
      descEl.textContent = 'レーダー上の7項目をクリックすると、項目の定義・具体例と選択中セグメントのスコア詳細が表示されます。';
      chipsEl.innerHTML = '';
      return;
    }

    const axis = AXES[state.focusedAxis];
    nameEl.textContent = `項目${state.focusedAxis + 1}：${axis.fullLabel}`;
    hintEl.textContent = `例：${axis.examples}`;
    descEl.textContent = axis.desc;

    chipsEl.innerHTML = state.selectedIds.map((id, idx) => {
      const seg = getSegment(id);
      const c = COLORS[idx % COLORS.length];
      return `
        <span class="score-chip">
          <span class="dot" style="background:${c.stroke}"></span>
          <span>${seg.short}</span>
          <strong>${seg.scores[state.focusedAxis].toFixed(1)}</strong>
        </span>
      `;
    }).join('');
  }

  // ---------- 2. Presets & Segment Controls ----------
  function renderPresets() {
    const container = document.getElementById('preset-buttons');
    const presetHint = document.getElementById('preset-hint');

    container.innerHTML = `<span class="preset-label">比較プリセット:</span>` + DATA.presets.map(p => `
      <button type="button" class="btn btn-sm ${state.activePreset === p.id ? 'is-active' : ''}" data-preset="${p.id}">
        ${p.label}
      </button>
    `).join('');

    container.querySelectorAll('button[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.getAttribute('data-preset');
        const preset = DATA.presets.find(p => p.id === pid);
        if (!preset) return;
        state.activePreset = pid;
        state.selectedIds = [...preset.ids];
        renderStudio();
        renderGallery();
      });
    });

    const activeP = DATA.presets.find(p => p.id === state.activePreset);
    presetHint.textContent = activeP ? activeP.label : 'カスタム比較中';
  }

  function renderSegmentSelector() {
    const container = document.getElementById('segment-selector');
    const countEl = document.getElementById('selected-count');

    container.innerHTML = DATA.segments.map(seg => {
      const c = getColorForSelected(seg.id);
      const selected = Boolean(c);
      const style = selected ? `border-color:${c.stroke};` : '';
      return `
        <button type="button" class="seg-toggle ${selected ? 'is-selected' : ''}" data-seg="${seg.id}" style="${style}">
          <span class="dot" style="background:${c ? c.stroke : 'transparent'}; border:1.5px solid ${c ? c.stroke : 'var(--border-strong)'};"></span>
          <span class="seg-name">${seg.short}</span>
        </button>
      `;
    }).join('');

    container.querySelectorAll('button[data-seg]').forEach(btn => {
      btn.addEventListener('click', () => {
        toggleSegmentSelection(btn.getAttribute('data-seg'));
      });
    });

    countEl.textContent = `選択中: ${state.selectedIds.length} / 最大4`;
  }

  function toggleSegmentSelection(id) {
    state.activePreset = null;
    if (state.selectedIds.includes(id)) {
      state.selectedIds = state.selectedIds.filter(x => x !== id);
    } else {
      if (state.selectedIds.length >= 4) {
        state.selectedIds.shift();
      }
      state.selectedIds.push(id);
    }
    renderStudio();
    renderGallery();
  }

  function renderCompareInsights() {
    const titleEl = document.getElementById('compare-box-title');
    const cardsEl = document.getElementById('compare-cards');
    const diffEl = document.getElementById('diff-pills');

    if (state.selectedIds.length === 0) {
      titleEl.textContent = '属性を選択してください';
      cardsEl.innerHTML = '<p class="compare-card-desc">上の属性ボタンまたは比較プリセットから最大4つまで重ね合わせて比較できます。</p>';
      diffEl.style.display = 'none';
      return;
    }

    const activeP = DATA.presets.find(p => p.id === state.activePreset);
    titleEl.textContent = activeP ? `比較ポイント：${activeP.label}` : '選択中セグメントの特徴＆ギャップ';

    cardsEl.innerHTML = state.selectedIds.map((id, idx) => {
      const seg = getSegment(id);
      const c = COLORS[idx % COLORS.length];
      return `
        <div class="compare-card">
          <div class="compare-card-head">
            <span class="compare-card-name">
              <span class="dot" style="background:${c.stroke}"></span>
              ${seg.name}
            </span>
            <span class="compare-card-tag">${seg.tag}</span>
          </div>
          <p class="compare-card-desc">${seg.summary}</p>
        </div>
      `;
    }).join('');

    // Highlight top 3 largest gaps when >= 2 segments selected
    if (state.selectedIds.length >= 2) {
      const segs = state.selectedIds.map(getSegment);
      const diffs = AXES.map((ax, i) => {
        const vals = segs.map(s => s.scores[i]);
        const max = Math.max(...vals);
        const min = Math.min(...vals);
        const spread = max - min;
        let detail = '';
        if (segs.length === 2) {
          const delta = segs[1].scores[i] - segs[0].scores[i];
          const sign = delta > 0 ? '+' : '';
          detail = `${segs[0].short}→${segs[1].short} ${sign}${delta.toFixed(1)}`;
        } else {
          const maxSeg = segs[vals.indexOf(max)].short;
          const minSeg = segs[vals.indexOf(min)].short;
          detail = `最大差 ${spread.toFixed(1)}（高:${maxSeg} / 低:${minSeg}）`;
        }
        return { label: ax.label, spread, detail };
      })
      .sort((a, b) => b.spread - a.spread)
      .slice(0, 3);

      diffEl.style.display = 'flex';
      diffEl.innerHTML = `<span class="preset-label" style="align-self:center;">差が大きい項目:</span>` +
        diffs.map(d => `<span class="diff-pill"><strong>${d.label}</strong>：${d.detail}</span>`).join('');
    } else {
      diffEl.style.display = 'none';
    }
  }

  function renderStudio() {
    renderPresets();
    renderMainRadar();
    renderAxisFocusBar();
    renderSegmentSelector();
    renderCompareInsights();
  }

  // ---------- 3. Simulator Editor ----------
  function renderEditor() {
    const panel = document.getElementById('editor-panel');
    const selectEl = document.getElementById('editor-segment-select');
    const slidersEl = document.getElementById('editor-sliders');

    panel.classList.toggle('is-open', state.editorOpen);
    if (!selectEl.options.length) {
      selectEl.innerHTML = DATA.segments.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
      selectEl.addEventListener('change', () => {
        state.editorSegmentId = selectEl.value;
        if (!state.selectedIds.includes(state.editorSegmentId)) {
          toggleSegmentSelection(state.editorSegmentId);
        }
        renderEditorSliders();
      });
    }
    selectEl.value = state.editorSegmentId;
    renderEditorSliders();
  }

  function renderEditorSliders() {
    const seg = getSegment(state.editorSegmentId);
    const slidersEl = document.getElementById('editor-sliders');
    slidersEl.innerHTML = AXES.map((ax, i) => `
      <div class="slider-item">
        <div class="slider-top">
          <span>${ax.label}</span>
          <span id="slider-val-${i}" style="color:var(--primary); font-variant-numeric:tabular-nums;">${seg.scores[i].toFixed(1)}</span>
        </div>
        <input type="range" min="1" max="5" step="0.5" value="${seg.scores[i]}" data-axis-idx="${i}" />
      </div>
    `).join('');

    slidersEl.querySelectorAll('input[type="range"]').forEach(inp => {
      inp.addEventListener('input', () => {
        const idx = Number(inp.getAttribute('data-axis-idx'));
        const val = parseFloat(inp.value);
        seg.scores[idx] = val;
        document.getElementById(`slider-val-${idx}`).textContent = val.toFixed(1);
        renderStudio();
        renderGallery();
        renderUCurve();
        renderDetailContent();
        renderScoreTable();
      });
    });
  }

  // ---------- 4. 9 Segment Mini Radar Gallery ----------
  function renderGallery() {
    const grid = document.getElementById('gallery-grid');
    grid.innerHTML = DATA.segments.map((seg, idx) => {
      const isSelected = state.selectedIds.includes(seg.id);
      const color = getColorForSelected(seg.id) || COLORS[idx % COLORS.length];
      const top2 = seg.scores
        .map((v, i) => ({ label: AXES[i].label, v }))
        .sort((a, b) => b.v - a.v)
        .slice(0, 2);

      const miniSvg = buildRadarSVG({
        width: 300,
        height: 205,
        cx: 150,
        cy: 104,
        maxR: 54,
        labelOffset: 12,
        fontSize: 9.5,
        ids: [seg.id],
        interactive: false,
        singleColor: color
      });

      return `
        <article class="card mini-card" style="${isSelected ? `border-color:${color.stroke};` : ''}">
          <div class="mini-card-head">
            <div>
              <h3>${seg.name}</h3>
              <div class="mini-tag">${seg.tag}</div>
            </div>
            <span class="mini-group">${seg.group}</span>
          </div>
          <div class="mini-svg-box">
            <svg viewBox="0 0 300 205" style="width:100%; max-width:295px; height:auto;">${miniSvg}</svg>
          </div>
          <div class="mini-top-axes">
            ${top2.map(t => `<span class="mini-badge">★ ${t.label} ${t.v.toFixed(1)}</span>`).join('')}
          </div>
          <p class="compare-card-desc">${seg.summary}</p>
          <div class="mini-actions">
            <button type="button" class="btn ${isSelected ? 'is-active' : ''}" data-gallery-compare="${seg.id}">
              ${isSelected ? '✓ 比較中' : '+ 比較に追加'}
            </button>
            <button type="button" class="btn" data-gallery-detail="${seg.id}">詳細分析 →</button>
          </div>
        </article>
      `;
    }).join('');

    grid.querySelectorAll('button[data-gallery-compare]').forEach(btn => {
      btn.addEventListener('click', () => {
        toggleSegmentSelection(btn.getAttribute('data-gallery-compare'));
        document.getElementById('studio').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    grid.querySelectorAll('button[data-gallery-detail]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.activeDetailId = btn.getAttribute('data-gallery-detail');
        renderDetailTabs();
        renderDetailContent();
        document.getElementById('deepdive').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  // ---------- 5. 7 Axes Cards ----------
  function renderAxesCards() {
    const grid = document.getElementById('axes-grid');
    grid.innerHTML = AXES.map((ax, i) => `
      <article class="card axis-card">
        <div class="axis-card-head">
          <span class="axis-num">${i + 1}</span>
          <h3>${ax.fullLabel}</h3>
        </div>
        <p>${ax.desc}</p>
        <div class="axis-meta-row">
          <span><strong>具体例：</strong>${ax.examples}</span>
          <span><strong>最高：</strong>${ax.highest} ／ <strong>最低：</strong>${ax.lowest}</span>
        </div>
      </article>
    `).join('');
  }

  // ---------- 6. Lifecycle U-Curve SVG ----------
  function renderUCurve() {
    const svg = document.getElementById('ucurve-svg');
    const stageIds = ['elem_child', 'jshs_child', 'univ', 'worker_2030', 'worker_4050', 'homemaker', 'exec', 'senior'];
    const stageLabels = ['就学児(本人)', '中高生(本人)', '大学生', '社会人20・30代', '社会人40・50代', '主婦', '経営者', '高齢者'];
    const segs = stageIds.map(getSegment);

    const W = 940, H = 250;
    const padL = 52, padR = 40, padT = 22, padB = 46;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const xOf = idx => padL + (plotW * idx) / (segs.length - 1);
    const yOf = val => padT + plotH - ((val - 1) / 4) * plotH;

    // 3 series:
    // Intrinsic/Wellbeing avg: joy(2), liberal(3), health(6)
    // Extrinsic/Practical avg: roi(0), skill(1)
    // Social/Belonging: social(4)
    const series = [
      {
        name: '内発・ウェルビーイング',
        color: '#059669',
        vals: segs.map(s => (s.scores[2] + s.scores[3] + s.scores[6]) / 3)
      },
      {
        name: '実利・スキル防衛',
        color: '#2563eb',
        vals: segs.map(s => (s.scores[0] + s.scores[1]) / 2)
      },
      {
        name: 'つながり・承認',
        color: '#ea580c',
        vals: segs.map(s => s.scores[4])
      }
    ];

    let out = '';
    // Horizontal grid lines 1..5
    for (let v = 1; v <= 5; v++) {
      const y = yOf(v);
      out += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="var(--grid-stroke)" stroke-dasharray="${v === 1 ? '' : '3,3'}" opacity="0.7" />`;
      out += `<text x="${padL - 12}" y="${y + 4}" text-anchor="end" font-size="11" fill="var(--text-soft)" font-weight="600">${v.toFixed(1)}</text>`;
    }

    // Vertical guides & x labels
    stageLabels.forEach((lbl, i) => {
      const x = xOf(i);
      out += `<line x1="${x.toFixed(1)}" y1="${padT}" x2="${x.toFixed(1)}" y2="${H - padB}" stroke="var(--grid-stroke)" opacity="0.35" />`;
      out += `<text x="${x.toFixed(1)}" y="${H - 16}" text-anchor="middle" font-size="12" fill="var(--text)" font-weight="600">${lbl}</text>`;
    });

    // Smooth polylines + dots
    series.forEach(ser => {
      const pts = ser.vals.map((v, i) => `${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ');
      out += `<polyline points="${pts}" fill="none" stroke="${ser.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`;
      ser.vals.forEach((v, i) => {
        const x = xOf(i);
        const y = yOf(v);
        out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.8" fill="${ser.color}" stroke="var(--surface)" stroke-width="1.6" />`;
        out += `<text x="${x.toFixed(1)}" y="${(y - 9).toFixed(1)}" text-anchor="middle" font-size="10.5" fill="${ser.color}" font-weight="700">${v.toFixed(1)}</text>`;
      });
    });

    svg.innerHTML = out;
  }

  // ---------- 7. Deep Dive Detail Tabs ----------
  function renderDetailTabs() {
    const bar = document.getElementById('detail-tabs');
    bar.innerHTML = DATA.segments.map(seg => `
      <button type="button" class="btn btn-sm ${state.activeDetailId === seg.id ? 'is-active' : ''}" data-detail-tab="${seg.id}">
        ${seg.name}
      </button>
    `).join('');

    bar.querySelectorAll('button[data-detail-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.activeDetailId = btn.getAttribute('data-detail-tab');
        renderDetailTabs();
        renderDetailContent();
      });
    });
  }

  function renderDetailContent() {
    const seg = getSegment(state.activeDetailId);
    const box = document.getElementById('detail-content');

    const barsHtml = AXES.map((ax, i) => {
      const val = seg.scores[i];
      const pct = (val / 5) * 100;
      return `
        <div class="bar-row">
          <span>${ax.label}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
          <span class="bar-val">${val.toFixed(1)}</span>
        </div>
      `;
    }).join('');

    box.innerHTML = `
      <div class="panel-head" style="margin-bottom:14px; padding-bottom:14px; border-bottom:1px solid var(--border); flex-wrap:wrap;">
        <div>
          <span class="mini-group" style="margin-bottom:6px; display:inline-block;">${seg.group}</span>
          <h3 style="margin:0; font-size:20px;">${seg.name} <span style="font-size:13px; color:var(--primary); font-weight:700; margin-left:6px;">［${seg.tag}］</span></h3>
        </div>
        <button type="button" class="btn btn-sm btn-primary" id="detail-add-compare">この属性をレーダー比較へ</button>
      </div>

      <div class="detail-grid">
        <div>
          <div class="detail-block">
            <h4>📑 公的・民間調査ファクト</h4>
            <ul class="detail-list">
              ${seg.facts.map(f => `<li>${f}</li>`).join('')}
            </ul>
          </div>
          <div class="detail-block">
            <h4>💬 SNS・メディア上のリアルな本音トレンド</h4>
            <ul class="detail-list">
              ${seg.snsVoices.map(v => `<li>${v}</li>`).join('')}
            </ul>
          </div>
          <div class="detail-block">
            <h4>💡 企画・サービス設計への示唆</h4>
            <div class="implication-box">${seg.implication}</div>
          </div>
        </div>
        <div>
          <h4 style="margin:0 0 12px; font-size:13.5px;">📊 7評価軸スコア内訳（5段階）</h4>
          ${barsHtml}
          <div style="margin-top:16px; display:flex; justify-content:center;">
            <svg viewBox="0 0 320 220" style="width:100%; max-width:320px; height:auto;">
              ${buildRadarSVG({
                width: 320, height: 220, cx: 160, cy: 112, maxR: 60, labelOffset: 13, fontSize: 10,
                ids: [seg.id], interactive: false, singleColor: COLORS[0]
              })}
            </svg>
          </div>
        </div>
      </div>
    `;

    document.getElementById('detail-add-compare').addEventListener('click', () => {
      if (!state.selectedIds.includes(seg.id)) {
        toggleSegmentSelection(seg.id);
      }
      document.getElementById('studio').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // ---------- 8. Score Matrix Table ----------
  function heatStyle(val) {
    if (val >= 4.5) return 'background:rgba(37, 99, 235, 0.22); color:var(--primary);';
    if (val >= 3.5) return 'background:rgba(5, 150, 105, 0.16); color:var(--accent);';
    if (val >= 2.5) return 'background:var(--surface-subtle); color:var(--text);';
    return 'background:transparent; color:var(--text-soft);';
  }

  function renderScoreTable() {
    const table = document.getElementById('score-table');
    const sorted = [...DATA.segments].sort((a, b) => {
      let va, vb;
      if (state.sortKey === 'stageOrder') {
        va = a.stageOrder; vb = b.stageOrder;
      } else if (state.sortKey === 'avg') {
        va = a.scores.reduce((s, x) => s + x, 0) / a.scores.length;
        vb = b.scores.reduce((s, x) => s + x, 0) / b.scores.length;
      } else {
        const idx = Number(state.sortKey);
        va = a.scores[idx]; vb = b.scores[idx];
      }
      return state.sortDir === 'asc' ? va - vb : vb - va;
    });

    const arrow = key => state.sortKey === String(key) ? (state.sortDir === 'asc' ? ' ▲' : ' ▼') : '';

    table.innerHTML = `
      <thead>
        <tr>
          <th data-sort="stageOrder">属性セグメント${arrow('stageOrder')}</th>
          ${AXES.map((ax, i) => `<th data-sort="${i}">${ax.label}${arrow(i)}</th>`).join('')}
          <th data-sort="avg">7軸平均${arrow('avg')}</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map(seg => {
          const avg = seg.scores.reduce((s, x) => s + x, 0) / seg.scores.length;
          return `
            <tr>
              <td>${seg.name}</td>
              ${seg.scores.map(v => `<td><span class="heat-cell" style="${heatStyle(v)}">${v.toFixed(1)}</span></td>`).join('')}
              <td><strong>${avg.toFixed(2)}</strong></td>
            </tr>
          `;
        }).join('')}
      </tbody>
    `;

    table.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort');
        if (state.sortKey === key) {
          state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortKey = key;
          state.sortDir = key === 'stageOrder' ? 'asc' : 'desc';
        }
        renderScoreTable();
      });
    });
  }

  // ---------- 9. Sources ----------
  function renderSources() {
    const grid = document.getElementById('sources-grid');
    grid.innerHTML = DATA.sources.map(s => `
      <div class="source-item">
        <div class="source-org">${s.org}</div>
        <div class="source-title">${s.title}</div>
      </div>
    `).join('');
  }

  // ---------- 10. Exports (CSV & SVG) ----------
  function exportCSV() {
    const headers = ['属性セグメント', 'タイプ特徴', ...AXES.map(a => a.label), '7軸平均'];
    const rows = DATA.segments.map(seg => {
      const avg = (seg.scores.reduce((s, x) => s + x, 0) / seg.scores.length).toFixed(2);
      return [seg.name, seg.tag, ...seg.scores.map(v => v.toFixed(1)), avg];
    });
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'learning_value_by_age_scores.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadRadarSVG() {
    const svgEl = document.getElementById('main-radar-svg');
    const cs = getComputedStyle(document.documentElement);
    const bg = cs.getPropertyValue('--surface').trim() || '#ffffff';
    const text = cs.getPropertyValue('--text').trim() || '#0f172a';
    const soft = cs.getPropertyValue('--text-soft').trim() || '#64748b';
    const grid = cs.getPropertyValue('--grid-stroke').trim() || '#cbd5e1';
    const primary = cs.getPropertyValue('--primary').trim() || '#2563eb';

    let inner = svgEl.innerHTML
      .replaceAll('var(--grid-stroke)', grid)
      .replaceAll('var(--text)', text)
      .replaceAll('var(--text-soft)', soft)
      .replaceAll('var(--surface)', bg)
      .replaceAll('var(--primary)', primary);

    // Add legend at bottom
    const legendItems = state.selectedIds.map((id, idx) => {
      const seg = getSegment(id);
      const c = COLORS[idx % COLORS.length];
      const x = 30 + idx * 115;
      return `<circle cx="${x}" cy="402" r="5" fill="${c.stroke}" /><text x="${x + 10}" y="406" font-size="12" font-family="sans-serif" font-weight="600" fill="${text}">${seg.short}</text>`;
    }).join('');

    const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 422" width="1080" height="844" style="font-family:sans-serif;"><rect width="100%" height="100%" fill="${bg}" />${inner}${legendItems}</svg>`;
    const blob = new Blob([fullSvg], { type: 'image/svg+xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'learning_value_radar.svg';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- 11. Theme Toggle ----------
  function initTheme() {
    const btn = document.getElementById('theme-toggle');
    const icon = document.getElementById('theme-icon');
    const label = document.getElementById('theme-label');
    const saved = localStorage.getItem('uai_theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
    }

    function syncLabel() {
      const isDark = document.documentElement.classList.contains('dark');
      icon.textContent = isDark ? '☀️' : '🌙';
      label.textContent = isDark ? 'ライト' : 'ダーク';
    }

    syncLabel();
    btn.addEventListener('click', () => {
      document.documentElement.classList.toggle('dark');
      const isDark = document.documentElement.classList.contains('dark');
      localStorage.setItem('uai_theme', isDark ? 'dark' : 'light');
      syncLabel();
    });
  }

  // ---------- Bind Global Events & Init ----------
  document.getElementById('clear-selection-btn').addEventListener('click', () => {
    state.activePreset = null;
    state.selectedIds = [];
    renderStudio();
    renderGallery();
  });

  document.getElementById('toggle-editor-btn').addEventListener('click', () => {
    state.editorOpen = !state.editorOpen;
    document.getElementById('toggle-editor-btn').classList.toggle('is-active', state.editorOpen);
    renderEditor();
  });

  document.getElementById('reset-scores-btn').addEventListener('click', () => {
    DATA.segments.forEach(seg => {
      seg.scores = [...initialScoresMap[seg.id]];
    });
    renderStudio();
    renderGallery();
    renderEditorSliders();
    renderUCurve();
    renderDetailContent();
    renderScoreTable();
  });

  document.getElementById('export-csv-btn').addEventListener('click', exportCSV);
  document.getElementById('download-svg-btn').addEventListener('click', downloadRadarSVG);

  initTheme();
  renderStudio();
  renderGallery();
  renderAxesCards();
  renderUCurve();
  renderDetailTabs();
  renderDetailContent();
  renderScoreTable();
  renderSources();
})();
