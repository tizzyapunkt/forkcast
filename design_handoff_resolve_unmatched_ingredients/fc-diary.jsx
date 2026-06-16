/* forkcast — Tagebuch (daily log / adhoc tracking) */
(function () {
  const { useState } = React;
  const Icon = window.Icon;
  const { IconBtn, MacroTriple, EntryList, fmt } = window;
  const D = window.FC_DATA;

  function kcalState(consumed, goal) {
    const remaining = goal - consumed;
    if (consumed === 0) return { badge: `${goal} kcal offen`, tone: 'idle', pct: 0 };
    if (remaining > 0) return { badge: `${fmt.r(remaining)} kcal offen`, tone: 'under', pct: (consumed / goal) * 100 };
    if (remaining === 0 || Math.abs(remaining) <= goal * 0.03) return { badge: '✓ erreicht', tone: 'good', pct: 100 };
    return { badge: `${fmt.r(-remaining)} kcal über Ziel`, tone: 'over', pct: 100 };
  }

  function SlotCard({ slot, entries, onAdd, onAmount, onRemove, onRemoveMany }) {
    let kcal = 0, p = 0, c = 0, f = 0;
    entries.forEach((e) => { const m = D.entryMacros(e); kcal += m.kcal; p += m.p; c += m.c; f += m.f; });
    return (
      <section className="fc-card" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 className="fc-h2" style={{ fontSize: 16.5 }}>{D.SLOT_LABEL[slot]}</h2>
            {kcal > 0 && <div className="fc-num fc-faint" style={{ fontSize: 12.5, marginTop: 2 }}>{fmt.macroStr(p, c, f)}</div>}
          </div>
          {kcal > 0 && <span className="fc-num" style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--primary)' }}>{kcal} kcal</span>}
          <button onClick={onAdd} className="fc-icon-btn" aria-label="Hinzufügen"
            style={{ background: 'var(--accent-soft)', color: 'var(--primary)', width: 38, height: 38, minWidth: 38, borderRadius: 11 }}>
            <Icon name="plus" size={20} strokeWidth={2.2} />
          </button>
        </div>
        {entries.length === 0 ? (
          <p className="fc-faint" style={{ fontSize: 14, marginTop: 8 }}>Noch nichts erfasst</p>
        ) : (
          <div style={{ marginTop: 6 }}>
            <EntryList entries={entries}
              onAmount={(e, a) => onAmount(e.id, a)} onRemove={(e) => onRemove(e.id)}
              onRemoveGroup={(items) => onRemoveMany(items.map((x) => x.id))} />
          </div>
        )}
      </section>
    );
  }

  function WeightCard() {
    const [val, setVal] = useState('');
    const [saved, setSaved] = useState(false);
    return (
      <section className="fc-card" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h2 className="fc-h2" style={{ fontSize: 16.5, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Icon name="weight" size={18} color="var(--primary)" /> Heutiges Gewicht
          </h2>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>
            Gewicht-Tracker
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input className="fc-input" placeholder="z. B. 78,4" inputMode="decimal" value={val}
            onChange={(e) => { setVal(e.target.value); setSaved(false); }} style={{ flex: 1 }} />
          <span className="fc-faint" style={{ fontSize: 14, fontWeight: 600 }}>kg</span>
          <button className={`fc-btn ${val ? 'fc-btn-primary' : 'fc-btn-soft'}`} disabled={!val}
            onClick={() => setSaved(true)} style={{ opacity: val ? 1 : .55 }}>
            {saved ? <Icon name="check" size={18} /> : 'Speichern'}
          </button>
        </div>
      </section>
    );
  }

  function DiaryScreen({ goal, log, setLog, dateLabel, onPrev, onNext, openAdd, alarm, headerMacroColor }) {
    let consumed = 0, p = 0, c = 0, f = 0;
    D.SLOTS.forEach((s) => log[s].forEach((e) => { const m = D.entryMacros(e); consumed += m.kcal; p += m.p; c += m.c; f += m.f; }));
    const st = kcalState(consumed, goal.calories);
    const badgeTone = { idle: 'rgba(255,255,255,0.7)', under: 'rgba(255,255,255,0.92)', good: '#bdf5dd', over: '#ffd4d4' }[st.tone];
    const barFill = st.tone === 'over' ? 'var(--error)' : (st.tone === 'good' ? 'var(--success)' : '#fff');
    // refinement: under-goal reads as calm/white; the legacy “Alarm-Rot” tweak reproduces the old all-red look
    const underRed = alarm && (st.tone === 'under' || st.tone === 'idle');
    const kcalColor = st.tone === 'over' ? '#ffd4d4' : (underRed ? '#ffc4c4' : '#fff');

    function amount(slot, id, a) { setLog((L) => ({ ...L, [slot]: L[slot].map((e) => e.id === id ? { ...e, amount: a } : e) })); }
    function remove(slot, id) { setLog((L) => ({ ...L, [slot]: L[slot].filter((e) => e.id !== id) })); }
    function removeMany(slot, ids) { const drop = new Set(ids); setLog((L) => ({ ...L, [slot]: L[slot].filter((e) => !drop.has(e.id)) })); }

    return (
      <>
        {/* purple header */}
        <header style={{ background: 'var(--header-grad)', color: '#fff', padding: '52px 18px 18px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em' }}>forkcast</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button className="fc-icon-btn" aria-label="Vorheriger Tag" onClick={onPrev} style={{ color: 'rgba(255,255,255,0.85)', width: 36, height: 36, minWidth: 36 }}><Icon name="chevL" size={20} /></button>
              <span style={{ fontSize: 15, fontWeight: 650, minWidth: 92, textAlign: 'center' }}>{dateLabel}</span>
              <button className="fc-icon-btn" aria-label="Nächster Tag" onClick={onNext} style={{ color: 'rgba(255,255,255,0.85)', width: 36, height: 36, minWidth: 36 }}><Icon name="chevR" size={20} /></button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginTop: 14 }}>
            <div className="fc-num" style={{ fontSize: 27, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1, color: kcalColor }}>
              {fmt.r(consumed)} <span style={{ fontSize: 17, fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>/ {goal.calories} kcal</span>
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: badgeTone, background: 'rgba(255,255,255,0.13)', padding: '5px 11px', borderRadius: 999, whiteSpace: 'nowrap' }}>{st.badge}</span>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.2)', overflow: 'hidden', margin: '12px 0 16px' }}>
            <div style={{ height: '100%', width: st.pct + '%', background: barFill, borderRadius: 99, transition: 'width .5s' }} />
          </div>
          <MacroTriple totals={{ p, c, f }} goal={goal} light colored={headerMacroColor} />
        </header>

        <div className="fc-scroll" style={{ padding: '14px 16px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <WeightCard />
          {D.SLOTS.map((slot) => (
            <SlotCard key={slot} slot={slot} entries={log[slot]}
              onAdd={() => openAdd(slot)} onAmount={(id, a) => amount(slot, id, a)} onRemove={(id) => remove(slot, id)} onRemoveMany={(ids) => removeMany(slot, ids)} />
          ))}
        </div>
      </>
    );
  }

  window.DiaryScreen = DiaryScreen;
})();
