/* forkcast shared UI primitives. Exports to window. */
(function () {
  const { useState, useEffect, useRef } = React;
  const Icon = window.Icon;
  const D = window.FC_DATA;

  // ---------- formatting ----------
  const r = (n) => Math.round(n);
  const macroStr = (p, c, f) => `${r(p)} P · ${r(c)} KH · ${r(f)} F`;
  const fmt = { r, macroStr };

  // canonical macro color tokens (mirrors --macro-* in fc-tokens.css)
  const MACRO_COLOR = { p: 'var(--macro-p)', c: 'var(--macro-c)', f: 'var(--macro-f)' };
  const MACRO_COLOR_ON = { p: 'var(--macro-p-on)', c: 'var(--macro-c-on)', f: 'var(--macro-f-on)' };

  // ---------- IconBtn (44px tap target guaranteed) ----------
  function IconBtn({ name, size = 21, danger, label, onClick, style, color }) {
    return (
      <button className={`fc-icon-btn${danger ? ' danger' : ''}`} aria-label={label} onClick={onClick} style={style}>
        <Icon name={name} size={size} color={color} />
      </button>
    );
  }

  // ---------- Stepper  (−  n  +) ----------
  function Stepper({ value, onChange, min = 1, max = 99 }) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', background: '#fff', border: '1px solid var(--border)', borderRadius: 11, overflow: 'hidden' }}>
        <button className="fc-icon-btn" aria-label="weniger" onClick={() => onChange(Math.max(min, value - 1))}
          style={{ borderRadius: 0, color: 'var(--primary)' }}><Icon name="minus" size={18} /></button>
        <span className="fc-num" style={{ minWidth: 30, textAlign: 'center', fontWeight: 700, fontSize: 16 }}>{value}</span>
        <button className="fc-icon-btn" aria-label="mehr" onClick={() => onChange(Math.min(max, value + 1))}
          style={{ borderRadius: 0, color: 'var(--primary)' }}><Icon name="plus" size={18} /></button>
      </div>
    );
  }

  // ---------- Macro mini-bars (3 thin bars w/ values) ----------
  // `colored` paints each bar in its macro token color instead of plain white/grey.
  function MacroTriple({ totals, goal, light, colored }) {
    const items = [
      { k: 'p', label: 'Eiweiß', cur: totals.p, goal: goal.protein },
      { k: 'c', label: 'KH', cur: totals.c, goal: goal.carbs },
      { k: 'f', label: 'Fett', cur: totals.f, goal: goal.fat },
    ];
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        {items.map((it) => {
          const pct = goal ? Math.min(100, (it.cur / it.goal) * 100) : 0;
          const track = light ? 'rgba(255,255,255,0.22)' : 'var(--muted)';
          const macroFill = light ? MACRO_COLOR_ON[it.k] : MACRO_COLOR[it.k];
          const fill = colored ? macroFill : (light ? '#fff' : MACRO_COLOR[it.k]);
          const txt = light ? 'rgba(255,255,255,0.95)' : 'var(--fg)';
          const sub = light ? 'rgba(255,255,255,0.6)' : 'var(--text-3)';
          return (
            <div key={it.k}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: sub }}>
                  {colored && <span style={{ width: 6, height: 6, borderRadius: 99, background: macroFill, flexShrink: 0 }} />}
                  {it.label}
                </span>
              </div>
              <div style={{ height: 4, borderRadius: 99, background: track, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: pct + '%', background: fill, borderRadius: 99, transition: 'width .4s' }} />
              </div>
              <div className="fc-num" style={{ marginTop: 5, fontSize: 12.5, fontWeight: 600, color: txt }}>
                {r(it.cur)}<span style={{ color: sub, fontWeight: 500 }}> / {it.goal} g</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ---------- inline-editable amount (tap to edit grams/ml) ----------
  function InlineAmount({ amount, unit, onChange }) {
    const [editing, setEditing] = useState(false);
    const [val, setVal] = useState(String(amount));
    if (editing) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <input autoFocus type="number" inputMode="decimal" value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={() => { const n = Number(val); if (Number.isFinite(n) && n > 0) onChange(n); setEditing(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
            style={{ width: 58, height: 34, border: '1px solid var(--accent)', borderRadius: 8, padding: '0 8px',
              fontSize: 15, textAlign: 'right', fontFamily: 'inherit', boxShadow: '0 0 0 3px var(--accent-soft)' }} />
          <span className="fc-faint" style={{ fontSize: 13 }}>{unit}</span>
        </span>
      );
    }
    return (
      <button onClick={() => { setVal(String(amount)); setEditing(true); }}
        style={{ background: 'var(--muted)', border: 'none', borderRadius: 8, padding: '4px 9px', cursor: 'pointer',
          fontSize: 13, fontWeight: 600, color: 'var(--muted-fg)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        <span className="fc-num">{amount}</span> {unit}
        <Icon name="pencil" size={12} style={{ opacity: .5, marginLeft: 1 }} />
      </button>
    );
  }

  // ---------- food entry row (shared by Tagebuch & Wochenplan) ----------
  // two-column layout so the macro line can NEVER overflow off-screen.
  function EntryRow({ entry, onAmount, onRemove }) {
    const m = D.entryMacros(entry);
    const sub = m.kind === 'recipe'
      ? <span className="fc-chip" style={{ background: 'var(--accent-soft)', color: 'var(--primary)' }}><Icon name="book" size={12} /> {m.portions} Portion{m.portions === 1 ? '' : 'en'}</span>
      : m.kind === 'quick'
        ? <span className="fc-chip">Schnell</span>
        : <InlineAmount amount={entry.amount} unit={m.unit} onChange={onAmount} />;
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 0' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.25, color: 'var(--fg)', textWrap: 'pretty' }}>{m.name}</div>
          <div style={{ marginTop: 7 }}>{sub}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, paddingTop: 1 }}>
          <div className="fc-num" style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>{m.kcal} kcal</div>
          <div className="fc-num fc-faint" style={{ fontSize: 12, marginTop: 3, whiteSpace: 'nowrap' }}>
            {fmt.macroStr(m.p, m.c, m.f)}
          </div>
        </div>
        <IconBtn name="x" size={18} label="Eintrag entfernen" danger onClick={onRemove} style={{ width: 38, height: 38, minWidth: 38, marginRight: -6 }} />
      </div>
    );
  }

  // ---------- entry list (shared by Tagebuch & Wochenplan) ----------
  // Renders entries, boxing contiguous runs that came from the same recipe under a
  // labelled header so recipe-sourced ingredients are clearly grouped & identifiable.
  // Callbacks receive the entry OBJECT (entries always carry a unique id).
  function EntryList({ entries, onAmount, onRemove, onRemoveGroup }) {
    const groups = [];
    entries.forEach((e) => {
      const rid = e.recipeRef ? e.recipeRef.id : null;
      const last = groups[groups.length - 1];
      if (last && last.rid === rid) last.items.push(e);
      else groups.push({ rid, ref: e.recipeRef || null, items: [e] });
    });
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {groups.map((g, gi) => g.rid ? (
          <div key={gi} style={{ border: '1px solid var(--border-soft)', borderLeft: '3px solid var(--accent)',
            borderRadius: 10, background: 'var(--accent-soft)', padding: '5px 10px 2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
              <Icon name="book" size={13} color="var(--primary)" />
              <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: 'var(--primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.ref.name}</span>
              <span className="fc-faint" style={{ fontSize: 11, fontWeight: 600 }}>{g.ref.portions} Port.</span>
              {onRemoveGroup && <button onClick={() => onRemoveGroup(g.items)} className="fc-icon-btn danger"
                aria-label="Rezept entfernen" style={{ width: 26, height: 26, minWidth: 26 }}><Icon name="x" size={13} /></button>}
            </div>
            <div className="fc-divide">
              {g.items.map((e) => (
                <EntryRow key={e.id} entry={e} onAmount={(a) => onAmount(e, a)} onRemove={() => onRemove(e)} />
              ))}
            </div>
          </div>
        ) : (
          <div key={gi} className="fc-divide">
            {g.items.map((e) => (
              <EntryRow key={e.id} entry={e} onAmount={(a) => onAmount(e, a)} onRemove={() => onRemove(e)} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  // ---------- Bottom nav (4 tabs: Heute / Planen / Rezepte / Einstellungen) ----------
  const NAV = [
    { id: 'diary', icon: 'diary', label: 'Tagebuch' },
    { id: 'plan', icon: 'calendar', label: 'Planen' },
    { id: 'recipes', icon: 'book', label: 'Rezepte' },
    { id: 'settings', icon: 'settings', label: 'Einstellungen' },
  ];
  function BottomNav({ active, onChange }) {
    return (
      <nav style={{
        display: 'flex', borderTop: '1px solid var(--border-soft)', background: 'rgba(245,245,255,0.9)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 22px)', paddingTop: 8, flexShrink: 0,
      }}>
        {NAV.map((n) => {
          const on = active === n.id;
          return (
            <button key={n.id} onClick={() => onChange(n.id)}
              style={{
                flex: 1, background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '4px 0',
                color: on ? 'var(--primary)' : 'var(--text-3)',
              }}>
              <Icon name={n.icon} size={23} strokeWidth={on ? 2.1 : 1.7} />
              <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 500, letterSpacing: '-0.01em' }}>{n.label}</span>
            </button>
          );
        })}
      </nav>
    );
  }

  // ---------- Bottom sheet ----------
  function Sheet({ open, onClose, children, title, right, onBack, maxHeight = '88%' }) {
    const [render, setRender] = useState(open);
    useEffect(() => { if (open) setRender(true); }, [open]);
    if (!render) return null;
    return (
      <div onClick={onClose}
        style={{ position: 'absolute', inset: 0, zIndex: 90, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          background: open ? 'rgba(30,26,60,0.34)' : 'rgba(30,26,60,0)', transition: 'background .25s',
          animation: 'fc-fade-in .2s' }}
        onTransitionEnd={() => { if (!open) setRender(false); }}>
        <div onClick={(e) => e.stopPropagation()}
          style={{ background: 'var(--bg)', borderRadius: '20px 20px 0 0', maxHeight, display: 'flex', flexDirection: 'column',
            transform: open ? 'translateY(0)' : 'translateY(100%)', transition: 'transform .28s cubic-bezier(.3,.8,.3,1)',
            boxShadow: '0 -8px 40px rgba(30,26,60,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
            <div style={{ width: 38, height: 5, borderRadius: 99, background: 'var(--border)' }} />
          </div>
          {(title || right || onBack) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 18px 8px' }}>
              {onBack && <IconBtn name="chevL" size={22} label="Zurück" onClick={onBack} color="var(--primary)" style={{ marginLeft: -10, width: 36, height: 36, minWidth: 36 }} />}
              <h2 className="fc-h2" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h2>
              {right}
            </div>
          )}
          <div className="fc-scroll" style={{ padding: '4px 18px 22px' }}>{children}</div>
        </div>
      </div>
    );
  }

  // ---------- Segmented tabs ----------
  function Tabs({ tabs, active, onChange }) {
    return (
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-soft)', marginBottom: 4 }}>
        {tabs.map((t) => {
          const on = active === t.id;
          return (
            <button key={t.id} onClick={() => onChange(t.id)}
              style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '11px 4px 10px',
                fontSize: 14.5, fontWeight: on ? 700 : 550, color: on ? 'var(--primary)' : 'var(--text-3)',
                borderBottom: on ? '2.5px solid var(--primary)' : '2.5px solid transparent', marginBottom: -1 }}>
              {t.label}
            </button>
          );
        })}
      </div>
    );
  }

  // ---------- food list row (search / recent) ----------
  function CatalogRow({ name, kcal, unit, off, onClick, right }) {
    return (
      <button onClick={onClick} style={{
        width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 10, padding: '11px 2px', minHeight: 56,
      }}>
        <span style={{ minWidth: 0, flex: 1, fontSize: 15.5, fontWeight: 550, color: 'var(--fg)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        {off && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.04em', color: 'var(--text-3)',
          background: 'var(--muted)', padding: '2px 6px', borderRadius: 5, flexShrink: 0 }}>OFF</span>}
        <span className="fc-num" style={{ flexShrink: 0, fontSize: 13.5, color: 'var(--muted-fg)', fontWeight: 600 }}>
          {kcal} kcal<span style={{ color: 'var(--text-3)', fontWeight: 500 }}> / 100{unit}</span>
        </span>
        {right}
      </button>
    );
  }

  // ---------- generic confirm dialog ----------
  function Confirm({ open, title, body, confirmLabel = 'Bestätigen', danger, onConfirm, onCancel }) {
    if (!open) return null;
    return (
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, zIndex: 95, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 28, background: 'rgba(30,26,60,0.4)', animation: 'fc-fade-in .15s' }}>
        <div onClick={(e) => e.stopPropagation()} className="fc-anim-pop"
          style={{ background: 'var(--bg)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 320, boxShadow: 'var(--shadow-pop)' }}>
          <h3 className="fc-h2" style={{ marginBottom: 6 }}>{title}</h3>
          {body && <p className="fc-muted" style={{ fontSize: 14, lineHeight: 1.45, marginBottom: 16 }}>{body}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="fc-btn fc-btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Abbrechen</button>
            <button className={`fc-btn ${danger ? 'fc-btn-danger' : 'fc-btn-primary'}`} style={{ flex: 1 }} onClick={onConfirm}>{confirmLabel}</button>
          </div>
        </div>
      </div>
    );
  }

  Object.assign(window, { IconBtn, Stepper, MacroTriple, InlineAmount, EntryRow, EntryList, BottomNav, Sheet, Tabs, CatalogRow, Confirm, fmt });
})();
