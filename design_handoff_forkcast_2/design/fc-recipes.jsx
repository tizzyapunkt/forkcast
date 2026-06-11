/* forkcast — Rezepte: list, detail, and the reworked editor.
   Editor changes (iteration 2):
   - "Pro Portion" summary promoted to a hero card at the TOP (with servings stepper).
   - The two ambiguous chips ("Nicht zählen" / "pro Stück") are unified into ONE
     measurement-mode control:  Gewicht · Stück · Frei  — each mode reveals the
     inputs that make sense (free amount + free unit for "Frei", count × g/Stück for "Stück").
   - Control style is tweakable: Segmentiert (clear) vs Menü (compact).
   - Per-ingredient note is collapsed behind "+ Notiz" to declutter long lists. */
(function () {
  const { useState, useRef, useEffect } = React;
  const Icon = window.Icon;
  const { IconBtn, Stepper, Confirm, fmt } = window;
  const D = window.FC_DATA;

  const MACROS = [
    { k: 'p', short: 'P', label: 'Eiweiß', color: 'var(--macro-p)' },
    { k: 'c', short: 'KH', label: 'KH', color: 'var(--macro-c)' },
    { k: 'f', short: 'F', label: 'Fett', color: 'var(--macro-f)' },
  ];

  // resolve a recipe ingredient (key+amount+meta) into a display view
  function view(ing) {
    const fd = D.FOODS[ing.key];
    const factor = ing.amount / 100;
    return {
      key: ing.key, name: fd.name, unit: fd.unit,
      untracked: !!fd.untracked, amount: ing.amount,
      note: ing.note, piece: ing.piece, displayQty: ing.displayQty,
      per100: fd.per100,
      kcal: Math.round(fd.per100.kcal * factor),
      p: fd.per100.p * factor, c: fd.per100.c * factor, f: fd.per100.f * factor,
    };
  }

  // ───────────────────────── LIST ─────────────────────────
  function RecipesScreen({ recipes, onOpen, onNew, onImport }) {
    return (
      <>
        <SimpleHeader title="Rezepte" />
        <div className="fc-scroll" style={{ padding: '16px 16px 28px' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button className="fc-btn fc-btn-ghost" style={{ flex: 1 }} onClick={onImport}><Icon name="camera" size={17} /> Aus Fotos</button>
            <button className="fc-btn fc-btn-primary" style={{ flex: 1 }} onClick={onNew}><Icon name="plus" size={17} /> Neu</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recipes.map((rec) => {
              const t = D.recipeTotals(rec);
              return (
                <button key={rec.id} onClick={() => onOpen(rec)} className="fc-card" style={{ textAlign: 'left', cursor: 'pointer',
                  padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-soft)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="cook" size={22} color="var(--primary)" /></span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 15.5, fontWeight: 650, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.name}</span>
                    <span className="fc-num" style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--primary)', marginTop: 2 }}>
                      {Math.round(t.kcal / rec.servings)} kcal <span className="fc-muted" style={{ fontWeight: 600 }}>· {fmt.macroStr(t.p / rec.servings, t.c / rec.servings, t.f / rec.servings)}</span>
                      <span className="fc-faint" style={{ fontWeight: 500 }}> / Portion</span>
                    </span>
                    <span className="fc-num fc-faint" style={{ fontSize: 11.5 }}>{rec.ingredients.length} Zutaten</span>
                  </span>
                  <Icon name="chevR" size={19} color="var(--text-3)" />
                </button>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  // ───────────────────────── DETAIL ─────────────────────────
  function RecipeDetail({ recipe, onBack, onEdit, onDelete }) {
    const [servings, setServings] = useState(recipe.servings);
    const [confirm, setConfirm] = useState(false);
    const t = D.recipeTotals(recipe);
    const scale = servings / recipe.servings;
    const per = t.kcal / recipe.servings;
    const views = recipe.ingredients.map(view);

    return (
      <>
        <SimpleHeader title={recipe.name} subtitle={`Ergibt ${recipe.servings} Portionen`} onBack={onBack} />
        <div className="fc-scroll" style={{ padding: '12px 16px 28px' }}>
          {/* actions row */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
            <button className="fc-btn fc-btn-ghost" style={{ padding: '0 14px', minHeight: 40 }} onClick={onEdit}><Icon name="pencil" size={16} /> Bearbeiten</button>
            <IconBtn name="trash" label="Rezept löschen" danger onClick={() => setConfirm(true)} style={{ width: 40, height: 40, minWidth: 40 }} />
          </div>

          {/* nutrition box */}
          <div className="fc-card" style={{ marginTop: 12, padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: 'var(--accent-soft)' }}>
              <span className="fc-eyebrow" style={{ color: 'var(--primary)' }}>Pro Portion</span>
              <span className="fc-num" style={{ fontSize: 15, fontWeight: 700 }}>{Math.round(per)} kcal <span className="fc-muted" style={{ fontWeight: 600 }}>· {fmt.macroStr(t.p / recipe.servings, t.c / recipe.servings, t.f / recipe.servings)}</span></span>
            </div>
          </div>

          {/* portions scaler */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 }}>
            <h2 className="fc-h2">Zutaten</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="fc-faint" style={{ fontSize: 13 }}>Portionen</span>
              <Stepper value={servings} onChange={setServings} />
            </div>
          </div>

          <div className="fc-divide" style={{ marginTop: 4 }}>
            {views.map((v, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 0' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 550 }}>{v.name}</span>
                    {v.untracked && <span className="fc-chip"><span className="fc-chip-dot" />Nicht gezählt</span>}
                  </div>
                  {v.note && <div style={{ fontSize: 12.5, fontStyle: 'italic', color: 'var(--text-3)', marginTop: 2 }}>{v.note}</div>}
                </div>
                <span className="fc-num" style={{ flexShrink: 0, fontSize: 14.5, fontWeight: 600, color: 'var(--muted-fg)', textAlign: 'right', maxWidth: 150 }}>
                  {v.displayQty ? v.displayQty : v.piece
                    ? `${v.piece.count} ${v.piece.label} (≈ ${Math.round(v.amount * scale)} ${v.unit})`
                    : `${Math.round(v.amount * scale)} ${v.unit}`}
                </span>
              </div>
            ))}
          </div>

          {recipe.steps.length > 0 && (
            <>
              <h2 className="fc-h2" style={{ marginTop: 22, marginBottom: 8 }}>Schritte</h2>
              <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {recipe.steps.map((s, i) => (
                  <li key={i} style={{ display: 'flex', gap: 12 }}>
                    <span className="fc-num" style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, background: 'var(--accent-soft)',
                      color: 'var(--primary)', fontWeight: 700, fontSize: 13.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                    <span style={{ fontSize: 14.5, lineHeight: 1.5, color: 'var(--fg)', textWrap: 'pretty', paddingTop: 2 }}>{s}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>

        <Confirm open={confirm} title={`„${recipe.name}“ löschen?`} confirmLabel="Löschen" danger
          onConfirm={() => { setConfirm(false); onDelete(); }} onCancel={() => setConfirm(false)} />
      </>
    );
  }

  // ───────────────────────── EDITOR ─────────────────────────
  // editable ingredient state seeded from recipe
  function seed(recipe) {
    if (!recipe) return [];
    return recipe.ingredients.map((ing) => {
      const fd = D.FOODS[ing.key];
      // split a stored "1 TL" displayQty into free.qty / free.unit
      let free = null;
      if (fd.untracked) {
        const dq = (ing.displayQty || '').trim();
        const m = dq.match(/^([\d.,]+)\s*(.*)$/);
        free = m ? { qty: m[1], unit: m[2] } : { qty: dq || String(ing.amount || ''), unit: dq ? '' : fd.unit };
      }
      return {
        key: ing.key, name: fd.name, unit: fd.unit, per100: fd.per100,
        amount: ing.amount, note: ing.note || '',
        untracked: !!fd.untracked,
        piece: ing.piece ? { count: ing.piece.count, label: ing.piece.label, gramsPer: ing.piece.gramsPer } : null,
        free,
      };
    });
  }

  function modeOf(r) { return r.piece ? 'piece' : r.untracked ? 'free' : 'weight'; }
  // the gram-equivalent that drives nutrition
  function gramsOf(r) {
    if (r.piece) return (Number(r.piece.count) || 0) * (Number(r.piece.gramsPer) || 0);
    return Number(r.amount) || 0;
  }

  function RecipeEditor({ recipe, measureStyle = 'segmented', onCancel, onSave }) {
    const [name, setName] = useState(recipe ? recipe.name : '');
    const [servings, setServings] = useState(recipe ? recipe.servings : 1);
    const [rows, setRows] = useState(() => seed(recipe));
    const [steps, setSteps] = useState(() => (recipe ? [...recipe.steps] : []));

    function patch(i, p) { setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, ...p } : r)); }
    function remove(i) { setRows((rs) => rs.filter((_, idx) => idx !== i)); }

    // live totals (only tracked rows)
    let kcal = 0, p = 0, c = 0, f = 0;
    rows.forEach((r) => {
      if (r.untracked) return;
      const fct = gramsOf(r) / 100;
      kcal += r.per100.kcal * fct; p += r.per100.p * fct; c += r.per100.c * fct; f += r.per100.f * fct;
    });
    const per = (n) => n / Math.max(1, servings);

    return (
      <>
        <SimpleHeader title={recipe ? 'Rezept bearbeiten' : 'Neues Rezept'} onBack={onCancel} />
        <div className="fc-scroll" style={{ padding: '16px 16px 28px' }}>
          <label className="fc-label">Name</label>
          <input className="fc-input" placeholder="z. B. Bolognese" value={name} onChange={(e) => setName(e.target.value)} />

          {/* HERO — Pro Portion at the top, servings stepper co-located */}
          <div className="fc-card" style={{ marginTop: 14, padding: '14px 16px 16px', background: 'linear-gradient(180deg, var(--accent-soft), var(--card))' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="fc-eyebrow" style={{ color: 'var(--primary)' }}>Pro Portion</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="fc-faint" style={{ fontSize: 12.5 }}>Ergibt</span>
                <Stepper value={servings} onChange={setServings} />
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

          {rows.length === 0
            ? <p className="fc-faint" style={{ fontSize: 14, padding: '8px 0' }}>Noch keine Zutaten. Tippe „Hinzufügen“.</p>
            : <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} className="fc-divide">
                {rows.map((r, i) => <IngredientRow key={i} r={r} measureStyle={measureStyle} onPatch={(pp) => patch(i, pp)} onRemove={() => remove(i)} />)}
              </ul>}

          {/* steps */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 6 }}>
            <h2 className="fc-h2">Schritte</h2>
            <button className="fc-btn fc-btn-ghost" style={{ padding: '0 13px', minHeight: 40 }} onClick={() => setSteps((s) => [...s, ''])}><Icon name="plus" size={16} /> Schritt</button>
          </div>
          {steps.length === 0
            ? <p className="fc-faint" style={{ fontSize: 14 }}>Noch keine Schritte (optional).</p>
            : <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {steps.map((s, i) => (
                  <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span className="fc-num" style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 7, background: 'var(--muted)', fontWeight: 700, fontSize: 12.5, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 7 }}>{i + 1}</span>
                    <input className="fc-input" value={s} placeholder="Schritt beschreiben…" onChange={(e) => setSteps((arr) => arr.map((x, idx) => idx === i ? e.target.value : x))} style={{ minHeight: 40 }} />
                    <IconBtn name="x" size={16} label="Schritt entfernen" onClick={() => setSteps((arr) => arr.filter((_, idx) => idx !== i))} style={{ width: 38, height: 38, minWidth: 38 }} />
                  </li>
                ))}
              </ol>}

          {/* actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <button className="fc-btn fc-btn-ghost" style={{ flex: 1, height: 50 }} onClick={onCancel}>Abbrechen</button>
            <button className="fc-btn fc-btn-primary" style={{ flex: 1.4, height: 50 }} onClick={onSave}>{recipe ? 'Speichern' : 'Anlegen'}</button>
          </div>
        </div>
      </>
    );
  }

  // ───────── one ingredient row ─────────
  function IngredientRow({ r, measureStyle, onPatch, onRemove }) {
    const [noteOpen, setNoteOpen] = useState(!!r.note);
    const mode = modeOf(r);
    const grams = gramsOf(r);
    const kcal = r.untracked ? null : Math.round(r.per100.kcal * grams / 100);

    function setMode(m) {
      if (m === mode) return;
      if (m === 'weight') onPatch({ untracked: false, piece: null });
      else if (m === 'piece') onPatch({ untracked: false, piece: r.piece || { count: 1, label: 'Stück', gramsPer: Number(r.amount) || 50 } });
      else onPatch({ untracked: true, piece: null, free: r.free || { qty: String(Number(r.amount) || 1), unit: '' } });
    }

    return (
      <li style={{ padding: '14px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* title row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 15.5, fontWeight: 600, color: r.untracked ? 'var(--muted-fg)' : 'var(--fg)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
          {!noteOpen && (
            <button onClick={() => setNoteOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-3)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, padding: '6px 4px', flexShrink: 0 }}>
              <Icon name="plus" size={13} /> Notiz
            </button>
          )}
          <IconBtn name="x" size={17} label={`${r.name} entfernen`} danger onClick={onRemove} style={{ width: 36, height: 36, minWidth: 36 }} />
        </div>

        {/* measurement-mode control */}
        {measureStyle === 'menu'
          ? <ModeMenu mode={mode} onMode={setMode} />
          : <ModeSegments mode={mode} onMode={setMode} />}

        {/* mode body */}
        <ModeBody r={r} mode={mode} kcal={kcal} grams={grams} onPatch={onPatch} />

        {/* note */}
        {noteOpen && (
          <div className="fc-anim-pop" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="pencil" size={14} color="var(--text-3)" style={{ flexShrink: 0 }} />
            <input className="fc-input" autoFocus={!r.note} placeholder="Notiz, z. B. fein gehackt" value={r.note}
              onChange={(e) => onPatch({ note: e.target.value })}
              style={{ minHeight: 36, background: 'transparent', border: 'none', padding: 0, fontStyle: r.note ? 'italic' : 'normal', fontSize: 13.5, color: 'var(--text-2)' }} />
            <IconBtn name="x" size={14} label="Notiz entfernen" onClick={() => { onPatch({ note: '' }); setNoteOpen(false); }} style={{ width: 30, height: 30, minWidth: 30 }} />
          </div>
        )}
      </li>
    );
  }

  // segmented control: Gewicht · Stück · Frei
  function ModeSegments({ mode, onMode }) {
    const opts = [['weight', 'Gewicht'], ['piece', 'Stück'], ['free', 'Frei']];
    return (
      <div style={{ display: 'flex', background: 'var(--muted)', borderRadius: 10, padding: 3, gap: 3 }}>
        {opts.map(([id, label]) => {
          const on = mode === id;
          return (
            <button key={id} onClick={() => onMode(id)}
              style={{ flex: 1, border: 'none', cursor: 'pointer', borderRadius: 8, padding: '8px 4px', minHeight: 36,
                fontSize: 13, fontWeight: on ? 700 : 550, fontFamily: 'inherit',
                backgroundColor: on ? '#fff' : 'transparent', color: on ? 'var(--primary)' : 'var(--muted-fg)',
                boxShadow: on ? 'var(--shadow-card)' : 'none', transition: 'color .15s' }}>
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  // compact dropdown alternative
  function ModeMenu({ mode, onMode }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
      if (!open) return;
      const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
      document.addEventListener('mousedown', h);
      return () => document.removeEventListener('mousedown', h);
    }, [open]);
    const LABELS = { weight: 'Nach Gewicht', piece: 'Nach Stück', free: 'Frei / nicht zählen' };
    const opts = [['weight', 'Nach Gewicht', 'g / ml — wird gezählt'], ['piece', 'Nach Stück', 'z. B. 2 Eier'], ['free', 'Frei / nicht zählen', 'eigene Menge & Einheit']];
    return (
      <div ref={ref} style={{ position: 'relative', alignSelf: 'flex-start' }}>
        <button onClick={() => setOpen((o) => !o)} className="fc-chip"
          style={{ cursor: 'pointer', minHeight: 34, padding: '0 10px', fontSize: 13, background: 'var(--muted)', color: 'var(--fg)' }}>
          <Icon name={mode === 'free' ? 'reset' : mode === 'piece' ? 'plus' : 'cook'} size={13} color="var(--primary)" />
          {LABELS[mode]} <Icon name="chevD" size={13} color="var(--text-3)" />
        </button>
        {open && (
          <div className="fc-anim-pop" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 30, width: 232,
            background: 'var(--bg)', border: '1px solid var(--border-soft)', borderRadius: 12, boxShadow: 'var(--shadow-pop)', padding: 5 }}>
            {opts.map(([id, title, sub]) => {
              const on = mode === id;
              return (
                <button key={id} onClick={() => { onMode(id); setOpen(false); }}
                  style={{ width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '9px 10px',
                    background: on ? 'var(--accent-soft)' : 'transparent', display: 'flex', flexDirection: 'column', gap: 1, fontFamily: 'inherit' }}>
                  <span style={{ fontSize: 14, fontWeight: on ? 700 : 600, color: on ? 'var(--primary)' : 'var(--fg)' }}>{title}</span>
                  <span className="fc-faint" style={{ fontSize: 11.5 }}>{sub}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // the inputs for the active mode
  function ModeBody({ r, mode, kcal, grams, onPatch }) {
    if (mode === 'free') {
      const free = r.free || { qty: '', unit: '' };
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="fc-input" inputMode="text" placeholder="Menge" value={free.qty}
              onChange={(e) => onPatch({ free: { ...free, qty: e.target.value } })}
              style={{ width: 78, height: 42, textAlign: 'center', fontWeight: 600, fontSize: 15 }} />
            <input className="fc-input" placeholder="Einheit — z. B. TL, Prise, nach Geschmack" value={free.unit}
              onChange={(e) => onPatch({ free: { ...free, unit: e.target.value } })}
              style={{ flex: 1, height: 42, fontSize: 15 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', fontSize: 12 }}>
            <span style={{ width: 5, height: 5, borderRadius: 99, background: 'currentColor' }} />
            Zählt nicht in die Nährwerte — nur als Hinweis im Rezept.
          </div>
        </div>
      );
    }
    if (mode === 'piece') {
      const pc = r.piece || { count: 1, label: 'Stück', gramsPer: 50 };
      const setPc = (p) => onPatch({ piece: { ...pc, ...p } });
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Stepper value={Number(pc.count) || 1} onChange={(v) => setPc({ count: v })} />
            <span className="fc-faint" style={{ fontSize: 15, fontWeight: 600 }}>×</span>
            <input className="fc-input" placeholder="Stück-Name, z. B. großes Ei" value={pc.label}
              onChange={(e) => setPc({ label: e.target.value })} style={{ flex: 1, height: 42, fontSize: 15 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="fc-faint" style={{ fontSize: 12.5 }}>pro Stück ≈</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <input type="number" inputMode="decimal" value={pc.gramsPer}
                onChange={(e) => setPc({ gramsPer: Number(e.target.value) || 0 })}
                className="fc-input" style={{ width: 66, height: 38, textAlign: 'right', padding: '0 8px', fontSize: 14.5, fontWeight: 600 }} />
              <span className="fc-faint" style={{ fontSize: 12.5 }}>{r.unit}</span>
            </span>
            <span className="fc-num fc-faint" style={{ fontSize: 12.5 }}>
              = {Math.round(grams)} {r.unit} · <span style={{ color: 'var(--muted-fg)', fontWeight: 600 }}>{kcal} kcal</span>
            </span>
          </div>
        </div>
      );
    }
    // weight
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <input type="number" inputMode="decimal" value={r.amount}
            onChange={(e) => onPatch({ amount: Number(e.target.value) || 0 })}
            className="fc-input" style={{ width: 92, height: 42, textAlign: 'right', padding: '0 11px', fontSize: 16, fontWeight: 600 }} />
          <span className="fc-faint" style={{ fontSize: 14, width: 24 }}>{r.unit}</span>
        </span>
        <span className="fc-num fc-faint" style={{ fontSize: 12.5, minWidth: 0 }}>
          <span style={{ color: 'var(--muted-fg)', fontWeight: 700 }}>{kcal} kcal</span> · {fmt.macroStr(r.per100.p * grams / 100, r.per100.c * grams / 100, r.per100.f * grams / 100)}
        </span>
      </div>
    );
  }

  // shared purple header. ONE rule app-wide: the header names where you are.
  // Top-level tabs pass their screen name; sub-screens pass onBack + the entity title.
  function SimpleHeader({ title = 'forkcast', subtitle, onBack, right }) {
    return (
      <header style={{ background: 'var(--header-grad)', color: '#fff', padding: '52px 18px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          {onBack && (
            <button className="fc-icon-btn" aria-label="Zurück" onClick={onBack}
              style={{ color: '#fff', width: 36, height: 36, minWidth: 36, marginLeft: -8, marginTop: -2, flexShrink: 0 }}>
              <Icon name="chevL" size={22} />
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, textWrap: 'pretty', overflowWrap: 'break-word' }}>{title}</h1>
            {subtitle && <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.72)', marginTop: 3 }}>{subtitle}</div>}
          </div>
          {right && <div style={{ flexShrink: 0, paddingTop: 1 }}>{right}</div>}
        </div>
      </header>
    );
  }

  Object.assign(window, { RecipesScreen, RecipeDetail, RecipeEditor, FCSimpleHeader: SimpleHeader });
})();
