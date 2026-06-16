/* forkcast — Einstellungen (goal + macro calculator), tidied hierarchy */
(function () {
  const { useState } = React;
  const Icon = window.Icon;
  const { fmt } = window;
  const D = window.FC_DATA;
  const SimpleHeader = window.FCSimpleHeader;

  function Field({ label, value, onChange, suffix }) {
    return (
      <div>
        <label className="fc-label">{label}</label>
        <div style={{ position: 'relative' }}>
          <input className="fc-input fc-num" value={value} onChange={(e) => onChange(e.target.value)} inputMode="numeric"
            style={{ fontWeight: 600, paddingRight: suffix ? 34 : 13 }} />
          {suffix && <span className="fc-faint" style={{ position: 'absolute', right: 13, top: 13, fontSize: 14 }}>{suffix}</span>}
        </div>
      </div>
    );
  }

  function SettingsScreen() {
    const g = D.GOAL;
    const [goal, setGoal] = useState({ calories: g.calories, protein: g.protein, carbs: g.carbs, fat: g.fat });
    const [calcOpen, setCalcOpen] = useState(false);
    const [dir, setDir] = useState('maintenance');
    const set = (k) => (v) => setGoal((s) => ({ ...s, [k]: v }));

    return (
      <>
        <SimpleHeader title="Einstellungen" />
        <div className="fc-scroll" style={{ padding: '16px 16px 32px', display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* ---- Ziel ---- */}
          <section>
            <h2 className="fc-h2" style={{ marginBottom: 12 }}>Ernährungsziel</h2>
            <div className="fc-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Kalorien (kcal)" value={goal.calories} onChange={set('calories')} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <Field label="Eiweiß" value={goal.protein} onChange={set('protein')} suffix="g" />
                <Field label="KH" value={goal.carbs} onChange={set('carbs')} suffix="g" />
                <Field label="Fett" value={goal.fat} onChange={set('fat')} suffix="g" />
              </div>
              <button className="fc-btn fc-btn-primary" style={{ width: '100%', height: 48 }}>Ziel speichern</button>
            </div>
          </section>

          {/* ---- Makro-Rechner (collapsible) ---- */}
          <section>
            <button onClick={() => setCalcOpen((o) => !o)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 0, marginBottom: calcOpen ? 12 : 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="target" size={19} color="var(--primary)" />
                <span className="fc-h2">Makro-Rechner</span>
              </span>
              <Icon name={calcOpen ? 'chevU' : 'chevD'} size={19} color="var(--text-3)" />
            </button>
            {!calcOpen && <p className="fc-faint" style={{ fontSize: 13, marginTop: 4 }}>Ziel automatisch aus Körperdaten berechnen.</p>}

            {calcOpen && (
              <div className="fc-anim-pop" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="fc-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Field label="Gewicht (kg)" value={76} onChange={() => {}} />
                    <Field label="Größe (cm)" value={177} onChange={() => {}} />
                    <Field label="Alter (Jahre)" value={35} onChange={() => {}} />
                    <div>
                      <label className="fc-label">Geschlecht</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {['Männlich', 'Weiblich'].map((s, i) => (
                          <button key={s} className="fc-btn" style={{ flex: 1, minHeight: 44, padding: 0, fontSize: 13.5,
                            background: i === 0 ? 'var(--accent-soft)' : '#fff', color: i === 0 ? 'var(--primary)' : 'var(--muted-fg)',
                            border: '1px solid ' + (i === 0 ? 'var(--accent)' : 'var(--border)') }}>{s}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="fc-label">Aktivitätsfaktor</label>
                    <div className="fc-input" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--muted)', border: '1px solid transparent', fontWeight: 600 }}>Sehr aktiv (1.725) <Icon name="chevD" size={16} color="var(--text-3)" /></div>
                  </div>
                  <div>
                    <label className="fc-label">Ziel-Phase</label>
                    <div className="fc-input" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--muted)', border: '1px solid transparent', fontWeight: 600 }}>Body Recomp <Icon name="chevD" size={16} color="var(--text-3)" /></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Field label="Eiweiß (g/kg)" value={2} onChange={() => {}} />
                    <Field label="Fett (% TDEE)" value={25} onChange={() => {}} suffix="%" />
                  </div>
                  <div>
                    <label className="fc-label">Kalorien-Anpassung</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[['deficit', 'Defizit'], ['maintenance', 'Erhalt'], ['surplus', 'Überschuss']].map(([id, lbl]) => (
                        <button key={id} onClick={() => setDir(id)} className="fc-btn" style={{ flex: 1, minHeight: 42, padding: 0, fontSize: 13.5,
                          background: dir === id ? 'var(--accent-soft)' : '#fff', color: dir === id ? 'var(--primary)' : 'var(--muted-fg)',
                          border: '1px solid ' + (dir === id ? 'var(--accent)' : 'var(--border)') }}>{lbl}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* preview */}
                <div className="fc-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 16px', background: 'var(--accent-soft)' }}><span className="fc-eyebrow" style={{ color: 'var(--primary)' }}>Vorschau</span></div>
                  <div style={{ padding: '8px 16px 12px' }} className="fc-divide">
                    {[['Grundumsatz (REE)', '1692 kcal'], ['Gesamtumsatz (TDEE)', '2919 kcal'], ['Ziel-Kalorien', '2919 kcal'], ['Eiweiß', '152 g'], ['Fett', '81 g'], ['Kohlenhydrate', '396 g']].map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14 }}>
                        <span className="fc-muted">{k}</span><span className="fc-num" style={{ fontWeight: 700 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="fc-btn fc-btn-ghost" style={{ flex: 1, height: 48 }}>Profil speichern</button>
                  <button className="fc-btn fc-btn-primary" style={{ flex: 1, height: 48 }}>Als Ziel</button>
                </div>
              </div>
            )}
          </section>

          {/* ---- secondary links ---- */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="fc-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left' }}>
              <Icon name="chart" size={20} color="var(--primary)" />
              <span style={{ flex: 1 }}><span style={{ display: 'block', fontWeight: 650, fontSize: 15 }}>Gewicht-Tracker</span><span className="fc-faint" style={{ fontSize: 12.5 }}>Trend, Diagramm, Historie</span></span>
              <Icon name="arrowR" size={18} color="var(--text-3)" />
            </button>
            <div className="fc-card" style={{ padding: '14px 16px' }}>
              <div style={{ fontWeight: 650, fontSize: 14.5, marginBottom: 4 }}>Unbekannte Zutaten aus Foto-Import</div>
              <p className="fc-faint" style={{ fontSize: 12.5, lineHeight: 1.45, marginBottom: 10 }}>Beim Foto-Import nicht erkannte Zutaten landen hier. Exportieren, ergänzen, dann leeren.</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="fc-chip">1 Eintrag</span>
                <span style={{ flex: 1 }} />
                <button className="fc-btn fc-btn-ghost" style={{ minHeight: 38, padding: '0 12px', fontSize: 13.5 }}>Exportieren</button>
                <button className="fc-btn fc-btn-danger" style={{ minHeight: 38, padding: '0 12px', fontSize: 13.5 }}>Leeren</button>
              </div>
            </div>
            <button className="fc-btn fc-btn-danger" style={{ width: '100%', height: 48, marginTop: 4 }}><Icon name="logout" size={17} /> Abmelden</button>
          </section>
        </div>
      </>
    );
  }

  window.SettingsScreen = SettingsScreen;
})();
