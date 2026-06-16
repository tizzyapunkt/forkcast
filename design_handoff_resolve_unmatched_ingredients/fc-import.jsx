/* forkcast — Foto-Import review screen ("Rezept prüfen").
   An AI-parsed recipe arrives with most ingredients matched and a few unmatched.
   The UnmatchedPanel is the centerpiece of the resolve flow: each unresolved row
   offers an AI "Zuordnen" affordance (proposal prefetched on mount) plus the
   manual + / × paths. Confirming a proposal moves the row into the ingredient
   list with its original amount/note intact. */
(function () {
  const { useState, useEffect, useRef } = React;
  const Icon = window.Icon;
  const { IconBtn, fmt } = window;
  const D = window.FC_DATA;
  const SimpleHeader = window.FCSimpleHeader;
  const ResolveSheet = window.ResolveSheet;
  const ResolvePane = window.ResolvePane;
  const IngredientRow = window.IngredientRow;

  const MACROS = [
    { k: 'p', label: 'Eiweiß', color: 'var(--macro-p)' },
    { k: 'c', label: 'KH', color: 'var(--macro-c)' },
    { k: 'f', label: 'Fett', color: 'var(--macro-f)' },
  ];
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function gramsOf(r) {
    if (r.untracked) return 0;
    if (r.piece) return (Number(r.piece.count) || 0) * (Number(r.piece.gramsPer) || 0);
    return Number(r.amount) || 0;
  }
  // resolved row built from an unedited proposal (the Vorschau quick-confirm path)
  function buildFromProposal(item, proposal) {
    if (proposal.verdict === 'synonym-of') {
      const f = D.FOODS[proposal.foodKey];
      return { key: proposal.foodKey, name: f.name, unit: f.unit, per100: f.per100, amount: item.amount,
        note: item.note || '', untracked: !!f.untracked, piece: null, free: null, source: 'FOODS' };
    }
    const e = proposal.entry;
    const key = 'user-' + e.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return { key, name: e.name, unit: e.unit, per100: { ...e.per100 }, amount: e.untracked ? 0 : item.amount,
      note: item.note || '', untracked: !!e.untracked, piece: null, free: e.untracked ? { qty: String(item.amount || 1), unit: item.unit } : null, source: 'USER' };
  }

  // ───────────────────────── one unmatched row ─────────────────────────
  function UnmatchedRow({ item, state, proposal, affordance, showConfidence, leaving, onOpen, onManual, onQuick, onDiscard }) {
    const hasProposal = state === 'ready' && proposal && proposal.verdict !== 'skip';
    const summary = proposal && proposal.verdict === 'new-food'
      ? `Neu · ${proposal.entry.name}`
      : proposal && proposal.verdict === 'synonym-of'
        ? `Treffer · ${D.FOODS[proposal.foodKey].name}`
        : null;

    // the AI affordance, by style + state
    let aff = null;
    if (state === 'loading') {
      aff = (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--primary)', fontSize: 12.5, fontWeight: 600, padding: '0 4px' }}>
          <span className="fc-spin" style={{ width: 13, height: 13, borderRadius: 99, border: '2px solid var(--accent-soft)', borderTopColor: 'var(--primary)', display: 'inline-block' }} /> KI prüft…
        </span>
      );
    } else if (state === 'error') {
      aff = (
        <button onClick={onOpen} className="fc-chip" style={{ cursor: 'pointer', background: 'hsl(0 84% 60% / 0.1)', color: 'var(--error)', minHeight: 32 }}>
          <Icon name="reset" size={13} /> Erneut
        </button>
      );
    } else if (!hasProposal) {
      aff = <span className="fc-faint" style={{ fontSize: 12, fontWeight: 600 }}>Kein Vorschlag</span>;
    } else if (affordance === 'Badge') {
      aff = (
        <button onClick={onOpen} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--accent-soft)', border: 'none',
          borderRadius: 99, padding: '6px 11px', cursor: 'pointer', color: 'var(--primary)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700 }}>
          <Icon name="sparkles" size={13} /> KI <Icon name="chevR" size={13} />
        </button>
      );
    } else { // Knopf (default)
      aff = (
        <button onClick={onOpen} className="fc-btn" style={{ minHeight: 36, padding: '0 13px', fontSize: 13.5, background: 'var(--primary)', color: '#fff' }}>
          <Icon name="sparkles" size={15} /> Zuordnen
        </button>
      );
    }

    return (
      <div style={{ overflow: 'hidden', animation: leaving ? 'fc-row-out .34s cubic-bezier(.4,0,.6,1) both' : undefined }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 0 10px' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, minWidth: 0 }}>
              <span style={{ fontSize: 15.5, fontWeight: 650, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
              <span className="fc-num fc-muted" style={{ fontSize: 13, fontWeight: 600, flexShrink: 0 }}>{item.amount} {item.unit}</span>
            </div>
            {item.note && <div style={{ fontSize: 12.5, fontStyle: 'italic', color: 'var(--text-3)', marginTop: 2 }}>{item.note}</div>}
            {affordance === 'Vorschau' && hasProposal && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <button onClick={onOpen} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--accent-soft)', border: 'none',
                  borderRadius: 8, padding: '5px 9px', cursor: 'pointer', color: 'var(--primary)', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, maxWidth: 200 }}>
                  <Icon name="sparkles" size={12} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</span>
                </button>
                <button onClick={onQuick} className="fc-btn fc-btn-primary" style={{ minHeight: 30, padding: '0 11px', fontSize: 12.5 }}>Bestätigen</button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {affordance !== 'Vorschau' && aff}
            {affordance === 'Vorschau' && (state === 'loading' || state === 'error' || !hasProposal) && aff}
            <IconBtn name="x" size={17} label={`${item.name} entfernen`} danger onClick={onDiscard} style={{ width: 36, height: 36, minWidth: 36 }} />
          </div>
        </div>
        {showConfidence && hasProposal && affordance !== 'Vorschau' && (
          <div style={{ paddingBottom: 8 }}>
            <span className="fc-faint" style={{ fontSize: 11 }}>{summary} · {Math.round(proposal.confidence * 100)}% sicher</span>
          </div>
        )}
      </div>
    );
  }

  // ───────────────────────── unmatched panel (centerpiece) ─────────────────────────
  function UnmatchedPanel({ items, allResolvedCount, tone, children, rowProps }) {
    const amber = tone === 'Amber';
    if (items.length === 0) {
      return (
        <div className="fc-card fc-anim-pop" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 11,
          background: 'hsl(146 52% 43% / 0.10)', border: '1px solid hsl(146 52% 43% / 0.35)' }}>
          <span style={{ width: 32, height: 32, borderRadius: 99, background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="check" size={19} color="#fff" />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700 }}>Alle Zutaten zugeordnet</div>
            <div className="fc-faint" style={{ fontSize: 12, marginTop: 1 }}>{allResolvedCount} neue Einträge in deiner Bibliothek gespeichert.</div>
          </div>
        </div>
      );
    }
    return (
      <div className="fc-card" style={{ padding: '15px 16px 6px', overflow: 'hidden',
        background: amber ? 'hsl(38 92% 50% / 0.09)' : 'var(--card)',
        border: amber ? '1px solid hsl(38 92% 50% / 0.5)' : '1px solid var(--border-soft)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: amber ? 'hsl(38 92% 50% / 0.18)' : 'var(--accent-soft)' }}>
            <Icon name="sparkles" size={17} color={amber ? 'var(--warning)' : 'var(--primary)'} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
              {items.length} {items.length === 1 ? 'Zutat' : 'Zutaten'} ohne Treffer
            </h2>
            <p className="fc-muted" style={{ fontSize: 12.5, lineHeight: 1.45, margin: '3px 0 0' }}>
              Tippe „Zuordnen", um den KI-Vorschlag zu prüfen, anzupassen oder manuell zu suchen.
            </p>
          </div>
        </div>
        <div className="fc-divide" style={{ marginTop: 10 }}>
          {items.map((item) => <UnmatchedRow key={item.id} item={item} {...rowProps(item)} />)}
        </div>
        {children}
      </div>
    );
  }

  // ───────────────────────── the review screen ─────────────────────────
  function ImportReview({ draft = D.IMPORT_DRAFT, surface = 'sheet', affordance = 'Knopf', showConfidence = true, panelTone = 'Amber', demoState = 'Bereit', measureStyle = 'segmented', onCancel, onSave }) {
    const [name, setName] = useState(draft.name);
    const [servings, setServings] = useState(draft.servings);
    const [rows, setRows] = useState(() => draft.matched.map((r) => ({ ...r })));
    const [unmatched, setUnmatched] = useState(() => draft.unmatched.map((u) => ({ ...u })));
    const [openId, setOpenId] = useState(null);       // sheet/inline open item id
    const [leaving, setLeaving] = useState({});        // ids animating out
    const [highlightKey, setHighlightKey] = useState(null);
    const [prefetching, setPrefetching] = useState(!reduced && demoState === 'Bereit');
    const resolvedCount = useRef(0);

    // simulate the background propose-ingredient-resolutions prefetch on mount
    useEffect(() => {
      if (demoState !== 'Bereit') { setPrefetching(false); return; }
      if (reduced) { setPrefetching(false); return; }
      setPrefetching(true);
      const t = setTimeout(() => setPrefetching(false), 1300);
      return () => clearTimeout(t);
    }, [demoState]);

    // per-item proposal + state
    const stateFor = () => demoState === 'Lädt' ? 'loading' : prefetching ? 'loading' : demoState === 'Fehler' ? 'error' : 'ready';
    const proposalFor = (item) => demoState === 'Übersprungen' ? { verdict: 'skip', reason: 'mehrdeutig' } : item.proposal;

    // live nutrition (tracked rows only) ÷ servings
    let kcal = 0, p = 0, c = 0, f = 0;
    rows.forEach((r) => { if (r.untracked) return; const fct = gramsOf(r) / 100; kcal += r.per100.kcal * fct; p += r.per100.p * fct; c += r.per100.c * fct; f += r.per100.f * fct; });
    const per = (n) => n / Math.max(1, servings);

    const openItem = unmatched.find((u) => u.id === openId) || null;

    function resolveItem(item, resolvedRow) {
      resolvedCount.current += 1;
      setHighlightKey(resolvedRow.key);
      setRows((rs) => [...rs, { ...resolvedRow, tag: resolvedRow.source === 'USER' ? 'USER' : 'Katalog', _new: true }]);
      setLeaving((L) => ({ ...L, [item.id]: true }));
      setOpenId(null);
      setTimeout(() => {
        setUnmatched((us) => us.filter((u) => u.id !== item.id));
        setLeaving((L) => { const n = { ...L }; delete n[item.id]; return n; });
      }, 340);
      setTimeout(() => setHighlightKey(null), 900);
    }
    function discard(item) {
      setLeaving((L) => ({ ...L, [item.id]: true }));
      setOpenId(null);
      setTimeout(() => {
        setUnmatched((us) => us.filter((u) => u.id !== item.id));
        setLeaving((L) => { const n = { ...L }; delete n[item.id]; return n; });
      }, 340);
    }
    const [manualOpen, setManualOpen] = useState(false); // open straight into manual mode

    const rowProps = (item) => ({
      state: stateFor(),
      proposal: proposalFor(item),
      affordance, showConfidence,
      leaving: !!leaving[item.id],
      onOpen: () => { setManualOpen(false); setOpenId(item.id); },
      onManual: () => { setManualOpen(true); setOpenId(item.id); },
      onQuick: () => resolveItem(item, buildFromProposal(item, proposalFor(item))),
      onDiscard: () => discard(item),
    });

    const paneProps = openItem ? {
      item: openItem, state: stateFor(), proposal: proposalFor(openItem), showConfidence,
      initialManual: manualOpen,
      onConfirm: (rrow) => resolveItem(openItem, rrow),
      onDiscard: () => discard(openItem),
      onRetry: () => { setPrefetching(true); setTimeout(() => setPrefetching(false), 1100); },
      onClose: () => setOpenId(null),
    } : null;

    const inline = surface === 'inline';

    return (
      <>
        <SimpleHeader title="Rezept prüfen" subtitle={`Aus ${draft.photos} Fotos · ${rows.length + unmatched.length} Zutaten`} onBack={onCancel} />
        <div className="fc-scroll" style={{ padding: '14px 16px 28px' }}>

          {/* CENTERPIECE — unmatched panel */}
          <UnmatchedPanel items={unmatched} allResolvedCount={resolvedCount.current} tone={panelTone} rowProps={rowProps}>
            {inline && openItem && (
              <div className="fc-anim-pop" style={{ borderTop: '1px solid var(--border-soft)', margin: '2px -16px 0', padding: '14px 16px 16px', background: 'var(--bg)' }}>
                <ResolvePane key={openItem.id} {...paneProps} />
              </div>
            )}
          </UnmatchedPanel>

          {/* name */}
          <label className="fc-label" style={{ marginTop: 18 }}>Name</label>
          <input className="fc-input" value={name} onChange={(e) => setName(e.target.value)} style={{ height: 46, fontWeight: 600 }} />

          {/* pro-portion hero */}
          <div className="fc-card" style={{ marginTop: 14, padding: '14px 16px 16px', background: 'linear-gradient(180deg, var(--accent-soft), var(--card))' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="fc-eyebrow" style={{ color: 'var(--primary)' }}>Pro Portion</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="fc-faint" style={{ fontSize: 12.5 }}>Ergibt</span>
                <window.Stepper value={servings} onChange={setServings} />
                <span className="fc-faint" style={{ fontSize: 12.5 }}>Portionen</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 12 }}>
              <span className="fc-num" style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1 }}>{Math.round(per(kcal))}</span>
              <span className="fc-muted" style={{ fontWeight: 600, fontSize: 15 }}>kcal</span>
            </div>
            <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
              {MACROS.map((m) => (
                <div key={m.k} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: m.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 600 }}>{m.label}</span>
                  <span className="fc-num" style={{ fontSize: 13.5, fontWeight: 700 }}>{fmt.r(per(m.k === 'p' ? p : m.k === 'c' ? c : f))} g</span>
                </div>
              ))}
            </div>
            <div className="fc-num fc-faint" style={{ fontSize: 11.5, marginTop: 11, paddingTop: 10, borderTop: '1px solid var(--border-soft)' }}>
              Gesamt {Math.round(kcal)} kcal für {servings} {servings === 1 ? 'Portion' : 'Portionen'}
            </div>
          </div>

          {/* ingredients */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 4 }}>
            <h2 className="fc-h2">Zutaten <span className="fc-faint" style={{ fontWeight: 600, fontSize: 14 }}>· {rows.length}</span></h2>
            <button className="fc-btn fc-btn-ghost" style={{ padding: '0 13px', minHeight: 40 }}><Icon name="plus" size={16} /> Hinzufügen</button>
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} className="fc-divide">
            {rows.map((r, i) => (
              <IngredientRow key={r.key + i} r={r} measureStyle={measureStyle} tag={r.tag} highlight={r._new && r.key === highlightKey}
                onPatch={(pp) => setRows((rs) => rs.map((x, idx) => idx === i ? { ...x, ...pp } : x))}
                onRemove={() => setRows((rs) => rs.filter((_, idx) => idx !== i))} />
            ))}
          </ul>

          {/* steps */}
          {draft.steps.length > 0 && (
            <>
              <h2 className="fc-h2" style={{ marginTop: 24, marginBottom: 8 }}>Schritte <span className="fc-faint" style={{ fontWeight: 600, fontSize: 14 }}>· {draft.steps.length}</span></h2>
              <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {draft.steps.map((s, i) => (
                  <li key={i} style={{ display: 'flex', gap: 12 }}>
                    <span className="fc-num" style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, background: 'var(--accent-soft)', color: 'var(--primary)', fontWeight: 700, fontSize: 13.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                    <span style={{ fontSize: 14.5, lineHeight: 1.5, textWrap: 'pretty', paddingTop: 2 }}>{s}</span>
                  </li>
                ))}
              </ol>
            </>
          )}

          {/* actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button className="fc-btn fc-btn-ghost" style={{ flex: 1, height: 50 }} onClick={onCancel}>Abbrechen</button>
            <button className="fc-btn fc-btn-primary" style={{ flex: 1.5, height: 50 }} onClick={onSave}>Rezept anlegen</button>
          </div>
          {unmatched.length > 0 && (
            <p className="fc-faint" style={{ fontSize: 12, textAlign: 'center', marginTop: 9 }}>
              {unmatched.length} {unmatched.length === 1 ? 'Zutat' : 'Zutaten'} noch offen — werden beim Anlegen verworfen.
            </p>
          )}
        </div>

        {/* sheet surface */}
        {!inline && <ResolveSheet item={openItem} {...(paneProps || {})} />}
      </>
    );
  }

  Object.assign(window, { ImportReview, UnmatchedPanel });
})();
