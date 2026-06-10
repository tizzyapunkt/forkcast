/* forkcast — Wochenplan (NEW weekly planning mode). 3 layout variations. */
(function () {
  const { useState } = React;
  const Icon = window.Icon;
  const { IconBtn, AddFoodSheet, MacroTriple, fmt } = window;
  const D = window.FC_DATA;

  function dayTotals(day) {
    let kcal = 0, p = 0, c = 0, f = 0, count = 0;
    D.SLOTS.forEach((s) => day.meals[s].forEach((e) => { const m = D.entryMacros(e); kcal += m.kcal; p += m.p; c += m.c; f += m.f; count++; }));
    return { kcal, p, c, f, count };
  }
  function toneFor(kcal, goal) {
    if (kcal === 0) return { fill: 'var(--border)', text: 'var(--text-3)' };
    const pct = kcal / goal;
    if (pct > 1.08) return { fill: 'var(--error)', text: 'var(--error)' };
    if (pct >= 0.92) return { fill: 'var(--success)', text: 'var(--success)' };
    return { fill: 'var(--accent)', text: 'var(--primary)' };
  }

  // a slot block: entries + add button (shared by list & agenda)
  function SlotBlock({ day, slot, entries, onAdd, onRemove }) {
    let kcal = 0, p = 0, c = 0, f = 0;
    entries.forEach((e) => { const m = D.entryMacros(e); kcal += m.kcal; p += m.p; c += m.c; f += m.f; });
    return (
      <div style={{ padding: '8px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-2)', flex: 1 }}>{D.SLOT_LABEL[slot]}</span>
          {kcal > 0 && <span className="fc-num" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--primary)' }}>{kcal} kcal</span>}
          <button onClick={onAdd} className="fc-icon-btn" aria-label="Hinzufügen" style={{ width: 32, height: 32, minWidth: 32, background: 'var(--accent-soft)', color: 'var(--primary)' }}><Icon name="plus" size={17} strokeWidth={2.3} /></button>
        </div>
        {kcal > 0 && <div className="fc-num fc-faint" style={{ fontSize: 11.5, fontWeight: 600, marginTop: 1 }}>{fmt.macroStr(p, c, f)}</div>}
        {entries.length === 0
          ? <div className="fc-faint" style={{ fontSize: 12.5, marginTop: 2 }}>—</div>
          : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {entries.map((e, i) => {
                const m = D.entryMacros(e);
                return <span key={i} className="fc-chip" style={{ padding: '5px 6px 5px 10px', maxWidth: '100%' }}>
                  {m.kind === 'recipe' && <Icon name="book" size={12} color="var(--primary)" />}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>{m.name}</span>
                  <button onClick={() => onRemove(i)} className="fc-icon-btn" aria-label="entfernen" style={{ width: 22, height: 22, minWidth: 22 }}><Icon name="x" size={12} /></button>
                </span>;
              })}
            </div>}
      </div>
    );
  }

  function DayBar({ kcal, goal }) {
    const tone = toneFor(kcal, goal);
    return (
      <div style={{ height: 5, borderRadius: 99, background: 'var(--muted)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: Math.min(100, (kcal / goal) * 100) + '%', background: tone.fill, borderRadius: 99, transition: 'width .4s' }} />
      </div>
    );
  }

  // ── LIST layout (accordion of 7 days) ──
  function ListLayout({ week, goal, expanded, setExpanded, addTo, removeFrom, onCopy }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {week.map((day, di) => {
          const t = dayTotals(day);
          const tone = toneFor(t.kcal, goal.calories);
          const open = expanded === di;
          return (
            <section key={di} className="fc-card" style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={() => setExpanded(open ? -1 : di)} style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: 0 }}>
                  <span style={{ width: 42, flexShrink: 0 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 700, lineHeight: 1 }}>{D.WEEKDAYS[di]}</span>
                    <span className="fc-num fc-faint" style={{ fontSize: 11.5 }}>{day.date}. Juni</span>
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                      <span className="fc-num" style={{ fontSize: 13.5, fontWeight: 700, color: tone.text }}>{t.kcal} <span className="fc-faint" style={{ fontWeight: 600 }}>/ {goal.calories}</span></span>
                      <span className="fc-num fc-faint" style={{ fontSize: 11.5, fontWeight: 600 }}>{t.count > 0 ? fmt.macroStr(t.p, t.c, t.f) : 'leer'}</span>
                    </span>
                    <DayBar kcal={t.kcal} goal={goal.calories} />
                  </span>
                  <Icon name={open ? 'chevU' : 'chevD'} size={17} color="var(--text-3)" style={{ flexShrink: 0 }} />
                </button>
              </div>
              {open && (
                <div className="fc-anim-pop" style={{ marginTop: 8, borderTop: '1px solid var(--border-soft)', paddingTop: 10 }}>
                  <div style={{ background: 'var(--muted)', borderRadius: 10, padding: '10px 12px', marginBottom: 4 }}>
                    <div className="fc-eyebrow" style={{ marginBottom: 8 }}>Tag gesamt</div>
                    <window.MacroTriple totals={{ p: t.p, c: t.c, f: t.f }} goal={goal} />
                  </div>
                  <div className="fc-divide">
                    {D.SLOTS.map((slot) => (
                      <SlotBlock key={slot} day={day} slot={slot} entries={day.meals[slot]}
                        onAdd={() => addTo(di, slot)} onRemove={(i) => removeFrom(di, slot, i)} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button className="fc-btn fc-btn-soft" style={{ flex: 1, minHeight: 38, fontSize: 13.5 }} onClick={() => onCopy(di)}><Icon name="copy" size={15} /> Tag kopieren</button>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    );
  }

  // ── AGENDA layout (week strip + one focused day) ──
  function AgendaLayout({ week, goal, selected, setSelected, addTo, removeFrom, onCopy }) {
    const day = week[selected];
    const t = dayTotals(day);
    return (
      <div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {week.map((d, di) => {
            const dt = dayTotals(d); const tone = toneFor(dt.kcal, goal.calories); const on = selected === di;
            const pct = Math.min(100, (dt.kcal / goal.calories) * 100);
            return (
              <button key={di} onClick={() => setSelected(di)} style={{ flex: 1, background: on ? 'var(--primary)' : 'var(--card)', border: '1px solid ' + (on ? 'var(--primary)' : 'var(--border-soft)'), borderRadius: 12, padding: '8px 2px 7px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: on ? '#fff' : 'var(--text-2)' }}>{D.WEEKDAYS[di]}</span>
                <span className="fc-num" style={{ fontSize: 13, fontWeight: 700, color: on ? '#fff' : 'var(--fg)' }}>{d.date}</span>
                <span style={{ width: 22, height: 4, borderRadius: 99, background: on ? 'rgba(255,255,255,0.35)' : 'var(--muted)', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: pct + '%', background: on ? '#fff' : tone.fill }} />
                </span>
              </button>
            );
          })}
        </div>
        <section className="fc-card" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
            <h2 className="fc-h2">{D.WEEKDAYS_LONG[selected]}, {day.date}. Juni</h2>
            <span className="fc-num" style={{ fontSize: 14, fontWeight: 700, color: toneFor(t.kcal, goal.calories).text }}>{t.kcal} <span className="fc-faint" style={{ fontWeight: 600 }}>/ {goal.calories}</span></span>
          </div>
          <DayBar kcal={t.kcal} goal={goal.calories} />
          <div style={{ marginTop: 12 }}>
            <window.MacroTriple totals={{ p: t.p, c: t.c, f: t.f }} goal={goal} />
          </div>
          <div className="fc-divide" style={{ marginTop: 8 }}>
            {D.SLOTS.map((slot) => (
              <SlotBlock key={slot} day={day} slot={slot} entries={day.meals[slot]}
                onAdd={() => addTo(selected, slot)} onRemove={(i) => removeFrom(selected, slot, i)} />
            ))}
          </div>
          <button className="fc-btn fc-btn-soft" style={{ width: '100%', marginTop: 12, minHeight: 40 }} onClick={() => onCopy(selected)}><Icon name="copy" size={16} /> Diesen Tag kopieren</button>
        </section>
      </div>
    );
  }

  // ── GRID layout (week × slots matrix overview) ──
  function GridLayout({ week, goal, addTo }) {
    return (
      <div style={{ overflowX: 'auto', margin: '0 -16px', padding: '0 16px' }}>
        <div style={{ minWidth: 540 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '46px repeat(4, 1fr) 56px', gap: 6, alignItems: 'center', marginBottom: 6 }}>
            <span />
            {D.SLOTS.map((s) => <span key={s} className="fc-eyebrow" style={{ textAlign: 'center', fontSize: 10 }}>{D.SLOT_LABEL[s].slice(0, 5)}</span>)}
            <span className="fc-eyebrow" style={{ textAlign: 'center', fontSize: 10 }}>kcal</span>
          </div>
          {week.map((day, di) => {
            const t = dayTotals(day); const tone = toneFor(t.kcal, goal.calories);
            return (
              <div key={di} style={{ display: 'grid', gridTemplateColumns: '46px repeat(4, 1fr) 56px', gap: 6, alignItems: 'stretch', marginBottom: 6 }}>
                <span style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1 }}>{D.WEEKDAYS[di]}</span>
                  <span className="fc-num fc-faint" style={{ fontSize: 10.5 }}>{day.date}.6.</span>
                </span>
                {D.SLOTS.map((slot) => {
                  const entries = day.meals[slot]; let kcal = 0; entries.forEach((e) => kcal += D.entryMacros(e).kcal);
                  return (
                    <button key={slot} onClick={() => addTo(di, slot)} style={{ minHeight: 50, borderRadius: 10, cursor: 'pointer',
                      border: '1px solid var(--border-soft)', background: entries.length ? 'var(--accent-soft)' : 'var(--card)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: 3, overflow: 'hidden' }}>
                      {entries.length === 0
                        ? <Icon name="plus" size={15} color="var(--text-3)" />
                        : <>
                            <span className="fc-num" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--primary)' }}>{kcal}</span>
                            <span className="fc-faint" style={{ fontSize: 9.5, lineHeight: 1, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{D.entryMacros(entries[0]).name.split(' ')[0]}{entries.length > 1 ? ` +${entries.length - 1}` : ''}</span>
                          </>}
                    </button>
                  );
                })}
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="fc-num" style={{ fontSize: 12.5, fontWeight: 700, color: tone.text }}>{t.kcal}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function PlannerScreen({ goal, layout }) {
    const [week, setWeek] = useState(() => D.makeWeek());
    const [expanded, setExpanded] = useState(1);
    const [selected, setSelected] = useState(1);
    const [target, setTarget] = useState(null); // {day, slot}
    const [copyFrom, setCopyFrom] = useState(null);

    const weekKcal = week.reduce((s, d) => s + dayTotals(d).kcal, 0);
    const weekMacro = week.reduce((s, d) => { const t = dayTotals(d); return { p: s.p + t.p, c: s.c + t.c, f: s.f + t.f }; }, { p: 0, c: 0, f: 0 });
    const avgMacro = { p: weekMacro.p / 7, c: weekMacro.c / 7, f: weekMacro.f / 7 };
    const plannedDays = week.filter((d) => dayTotals(d).count > 0).length;

    function addTo(day, slot) { setTarget({ day, slot }); }
    function removeFrom(day, slot, i) {
      setWeek((W) => W.map((d, di) => di === day ? { ...d, meals: { ...d.meals, [slot]: d.meals[slot].filter((_, x) => x !== i) } } : d));
    }
    function onAdd(entry) {
      if (!target) return;
      setWeek((W) => W.map((d, di) => di === target.day ? { ...d, meals: { ...d.meals, [target.slot]: [...d.meals[target.slot], entry] } } : d));
    }
    function copyToNext(di) {
      setWeek((W) => {
        const src = W[di]; const tgt = (di + 1) % 7;
        return W.map((d, x) => x === tgt ? { ...d, meals: JSON.parse(JSON.stringify(src.meals)) } : d);
      });
      setCopyFrom(null);
    }

    return (
      <>
        <header style={{ background: 'var(--header-grad)', color: '#fff', padding: '52px 18px 16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em' }}>Wochenplan</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button className="fc-icon-btn" aria-label="Vorherige Woche" style={{ color: 'rgba(255,255,255,0.85)', width: 36, height: 36, minWidth: 36 }}><Icon name="chevL" size={20} /></button>
              <span style={{ fontSize: 14, fontWeight: 650 }}>1.–7. Juni</span>
              <button className="fc-icon-btn" aria-label="Nächste Woche" style={{ color: 'rgba(255,255,255,0.85)', width: 36, height: 36, minWidth: 36 }}><Icon name="chevR" size={20} /></button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 14 }}>
            <span><span className="fc-num" style={{ fontSize: 19, fontWeight: 800 }}>{Math.round(weekKcal / 7)}</span> <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Ø kcal/Tag</span></span>
            <span><span className="fc-num" style={{ fontSize: 19, fontWeight: 800 }}>{plannedDays}/7</span> <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Tage geplant</span></span>
          </div>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.16)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 9 }}>Ø Makros / Tag</div>
            <MacroTriple totals={avgMacro} goal={goal} light />
          </div>
        </header>

        <div className="fc-scroll" style={{ padding: '14px 16px 28px' }}>
          {layout === 'agenda' && <AgendaLayout week={week} goal={goal} selected={selected} setSelected={setSelected} addTo={addTo} removeFrom={removeFrom} onCopy={setCopyFrom} />}
          {layout === 'grid' && <GridLayout week={week} goal={goal} addTo={addTo} />}
          {(!layout || layout === 'list') && <ListLayout week={week} goal={goal} expanded={expanded} setExpanded={setExpanded} addTo={addTo} removeFrom={removeFrom} onCopy={setCopyFrom} />}
        </div>

        <AddFoodSheet open={!!target} slot={target ? target.slot : null} onClose={() => setTarget(null)} onAdd={onAdd} />

        {copyFrom !== null && (
          <div onClick={() => setCopyFrom(null)} style={{ position: 'absolute', inset: 0, zIndex: 95, background: 'rgba(30,26,60,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 28, animation: 'fc-fade-in .15s' }}>
            <div onClick={(e) => e.stopPropagation()} className="fc-anim-pop" style={{ background: 'var(--bg)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 320, boxShadow: 'var(--shadow-pop)' }}>
              <h3 className="fc-h2" style={{ marginBottom: 6 }}>{D.WEEKDAYS_LONG[copyFrom]} kopieren</h3>
              <p className="fc-muted" style={{ fontSize: 14, lineHeight: 1.45, marginBottom: 16 }}>Alle geplanten Mahlzeiten auf den Folgetag übertragen.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="fc-btn fc-btn-ghost" style={{ flex: 1 }} onClick={() => setCopyFrom(null)}>Abbrechen</button>
                <button className="fc-btn fc-btn-primary" style={{ flex: 1 }} onClick={() => copyToNext(copyFrom)}>Auf {D.WEEKDAYS[(copyFrom + 1) % 7]}.</button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  window.PlannerScreen = PlannerScreen;
})();
