/* forkcast — resolve-unmatched-ingredients flow.
   The editable show-and-confirm step for an AI proposal on an unmatched import
   ingredient. One ResolvePane drives every proposal state — loading / new-food /
   synonym-of / skip / error — plus a manual catalog-match fallback. The same pane
   renders inside a bottom Sheet OR inline in the panel (tweakable surface). */
(function () {
  const { useState, useEffect } = React;
  const Icon = window.Icon;
  const { IconBtn, Sheet, CatalogRow, fmt } = window;
  const D = window.FC_DATA;

  const slug = (s) => 'user-' + (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // live nutrition for `amount` of a per-100 entry
  function preview(amount, per100) {
    const fct = (Number(amount) || 0) / 100;
    return { kcal: Math.round(per100.kcal * fct), p: per100.p * fct, c: per100.c * fct, f: per100.f * fct };
  }

  // ── small labelled number field ──
  function NumField({ label, value, suffix, onChange, estimate, w }) {
    return (
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {label}
          {estimate && <span style={{ width: 5, height: 5, borderRadius: 99, background: 'var(--warning)' }} title="KI-Schätzung" />}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <input type="number" inputMode="decimal" value={value}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
            className="fc-input fc-num" style={{ width: w || 64, height: 40, textAlign: 'right', padding: '0 9px', fontSize: 15, fontWeight: 600 }} />
          {suffix && <span className="fc-faint" style={{ fontSize: 12.5 }}>{suffix}</span>}
        </span>
      </label>
    );
  }

  function ConfChip({ confidence }) {
    const pct = Math.round(confidence * 100);
    const tone = pct >= 85 ? 'var(--success)' : pct >= 70 ? 'var(--warning)' : 'var(--text-3)';
    return (
      <span className="fc-chip" style={{ background: 'var(--muted)', color: 'var(--muted-fg)', fontSize: 11 }}>
        <span style={{ width: 6, height: 6, borderRadius: 99, background: tone }} /> KI · {pct}%
      </span>
    );
  }

  function Eyebrow({ icon, children, color }) {
    return (
      <div className="fc-eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 5, color: color || 'var(--primary)' }}>
        <Icon name={icon} size={13} color={color || 'var(--primary)'} /> {children}
      </div>
    );
  }

  // the original draft line being resolved (name + amount + note)
  function OriginalLine({ item }) {
    return (
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>{item.name}</span>
        <span className="fc-num fc-muted" style={{ fontSize: 14, fontWeight: 600 }}>{item.amount} {item.unit}</span>
        {item.note && <span style={{ fontSize: 12.5, fontStyle: 'italic', color: 'var(--text-3)' }}>· {item.note}</span>}
      </div>
    );
  }

  // resolved-row preview card (what lands in the ingredient list)
  function ResultPreview({ name, amount, unit, per100, tag }) {
    const m = preview(amount, per100);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 11,
        background: 'var(--accent-soft)', border: '1px solid var(--border-soft)' }}>
        <Icon name="check" size={17} color="var(--primary)" />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14.5, fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
            {tag && <span className="fc-chip" style={{ fontSize: 9.5, padding: '1px 6px', background: tag === 'USER' ? '#fff' : 'var(--muted)', color: tag === 'USER' ? 'var(--primary)' : 'var(--muted-fg)' }}>{tag}</span>}
          </div>
          <div className="fc-num fc-faint" style={{ fontSize: 12, marginTop: 2 }}>{amount} {unit} · {m.kcal} kcal · {fmt.macroStr(m.p, m.c, m.f)}</div>
        </div>
      </div>
    );
  }

  // ── loading skeleton ──
  function LoadingState() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '6px 0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'var(--primary)' }}>
          <span className="fc-spin" style={{ width: 16, height: 16, borderRadius: 99, border: '2px solid var(--accent-soft)', borderTopColor: 'var(--primary)', display: 'inline-block' }} />
          <Eyebrow icon="sparkles">KI sucht einen passenden Eintrag…</Eyebrow>
        </div>
        <div className="fc-shimmer" style={{ height: 14, borderRadius: 6, width: '70%' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="fc-shimmer" style={{ height: 52, borderRadius: 9, flex: 1 }} />
          <div className="fc-shimmer" style={{ height: 52, borderRadius: 9, flex: 1 }} />
          <div className="fc-shimmer" style={{ height: 52, borderRadius: 9, flex: 1 }} />
        </div>
        <div className="fc-shimmer" style={{ height: 44, borderRadius: 10 }} />
      </div>
    );
  }

  // ── error / skip "no proposal" footer with manual fallbacks ──
  function FallbackActions({ onManual, onDiscard }) {
    return (
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button className="fc-btn fc-btn-ghost" style={{ flex: 1 }} onClick={onManual}><Icon name="search" size={16} /> Katalog</button>
        <button className="fc-btn fc-btn-danger" style={{ flex: 1 }} onClick={onDiscard}><Icon name="trash" size={15} /> Entfernen</button>
      </div>
    );
  }

  // ── manual catalog match (the + path) ──
  function ManualMatch({ item, onPick, onBack }) {
    const [q, setQ] = useState(item.name);
    const results = D.matchSearch(q);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Eyebrow icon="search">Aus Katalog zuordnen</Eyebrow>
        <div style={{ position: 'relative' }}>
          <Icon name="search" size={16} color="var(--text-3)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input className="fc-input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lebensmittel suchen…"
            style={{ paddingLeft: 36, height: 46 }} />
        </div>
        <div className="fc-divide" style={{ maxHeight: 260, overflowY: 'auto' }}>
          {results.length === 0
            ? <p className="fc-faint" style={{ fontSize: 13.5, padding: '14px 2px' }}>Kein Treffer. Pass die Suche an oder lege oben einen neuen Eintrag an.</p>
            : results.map((f) => (
                <CatalogRow key={f.key} name={f.name} kcal={f.kcal} unit={f.unit} onClick={() => onPick(f)} />
              ))}
        </div>
        <button className="fc-btn fc-btn-soft" style={{ alignSelf: 'flex-start' }} onClick={onBack}><Icon name="chevL" size={16} /> Zurück zum Vorschlag</button>
      </div>
    );
  }

  // ── the editable proposal, by verdict ──
  function ProposalContent({ item, proposal, draft, setDraft, showConfidence, aiAssisted = true, onManual }) {
    if (proposal.verdict === 'synonym-of') {
      const food = D.FOODS[proposal.foodKey];
      const m = preview(item.amount, food.per100);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Eyebrow icon="sparkles">Treffer im Katalog</Eyebrow>
            {showConfidence && aiAssisted && proposal.confidence != null && <ConfChip confidence={proposal.confidence} />}
          </div>
          <div className="fc-card" style={{ padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="check" size={20} color="var(--primary)" />
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 15.5, fontWeight: 650 }}>{food.name}</span>
                <span className="fc-chip" style={{ fontSize: 9.5, padding: '1px 6px' }}>Katalog</span>
              </div>
              <div className="fc-num fc-faint" style={{ fontSize: 12.5, marginTop: 2 }}>{food.per100.kcal} kcal · {fmt.macroStr(food.per100.p, food.per100.c, food.per100.f)} / 100 {food.unit}</div>
            </div>
          </div>
          <p className="fc-muted" style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>
            „{item.name}" wird als <strong style={{ color: 'var(--fg)', fontWeight: 650 }}>Synonym</strong> für {food.name} gelernt — künftig automatisch erkannt.
          </p>
          <ResultPreview name={food.name} amount={item.amount} unit={food.unit} per100={food.per100} tag="Katalog" />
          <button onClick={onManual} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--primary)', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, padding: '4px 0' }}>
            Anderes Lebensmittel wählen
          </button>
        </div>
      );
    }
    // new-food (editable entry)
    const e = draft;
    const setEntry = (p) => setDraft({ ...e, ...p });
    const setMacro = (k, v) => setDraft({ ...e, per100: { ...e.per100, [k]: v === '' ? '' : v } });
    const cleanPer = { kcal: Number(e.per100.kcal) || 0, p: Number(e.per100.p) || 0, c: Number(e.per100.c) || 0, f: Number(e.per100.f) || 0 };
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Eyebrow icon="sparkles">{aiAssisted ? 'Neuer Eintrag · KI-Vorschlag' : 'Neuer Eintrag'}</Eyebrow>
          {showConfidence && aiAssisted && proposal.confidence != null && <ConfChip confidence={proposal.confidence} />}
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span className="fc-label" style={{ margin: 0 }}>Name</span>
          <input className="fc-input" value={e.name} onChange={(ev) => setEntry({ name: ev.target.value })} style={{ height: 46, fontSize: 16, fontWeight: 600 }} />
        </label>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <span className="fc-label" style={{ marginBottom: 5 }}>Einheit</span>
            <div style={{ display: 'flex', background: 'var(--muted)', borderRadius: 9, padding: 3, gap: 3 }}>
              {['g', 'ml'].map((u) => {
                const on = e.unit === u;
                return (
                  <button key={u} onClick={() => setEntry({ unit: u })}
                    style={{ border: 'none', cursor: 'pointer', borderRadius: 7, padding: '7px 18px', minHeight: 34, fontSize: 13.5, fontWeight: on ? 700 : 550, fontFamily: 'inherit',
                      background: on ? '#fff' : 'transparent', color: on ? 'var(--primary)' : 'var(--muted-fg)', boxShadow: on ? 'var(--shadow-card)' : 'none', transition: 'color .15s' }}>{u}</button>
                );
              })}
            </div>
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', paddingBottom: 4 }}>
            <span onClick={() => setEntry({ untracked: !e.untracked })} style={{ width: 40, height: 24, borderRadius: 99, background: e.untracked ? 'var(--primary)' : 'var(--muted)', position: 'relative', transition: 'background .15s', flexShrink: 0 }}>
              <span style={{ position: 'absolute', top: 2, left: e.untracked ? 18 : 2, width: 20, height: 20, borderRadius: 99, background: '#fff', boxShadow: 'var(--shadow-card)', transition: 'left .15s' }} />
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>Nicht zählen</span>
          </label>
        </div>

        {!e.untracked && (
          <div>
            <span className="fc-label" style={{ marginBottom: 7 }}>Nährwerte <span className="fc-faint" style={{ fontWeight: 500 }}>· pro 100 {e.unit}</span></span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
              <NumField label="kcal" value={e.per100.kcal} estimate={aiAssisted} onChange={(v) => setMacro('kcal', v)} w="100%" />
              <NumField label="Eiweiß" value={e.per100.p} suffix="g" estimate={aiAssisted} onChange={(v) => setMacro('p', v)} w="100%" />
              <NumField label="KH" value={e.per100.c} suffix="g" estimate={aiAssisted} onChange={(v) => setMacro('c', v)} w="100%" />
              <NumField label="Fett" value={e.per100.f} suffix="g" estimate={aiAssisted} onChange={(v) => setMacro('f', v)} w="100%" />
            </div>
            {aiAssisted && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, color: 'var(--text-3)', fontSize: 11.5 }}>
                <span style={{ width: 5, height: 5, borderRadius: 99, background: 'var(--warning)' }} /> KI-geschätzt — bei Bedarf anpassen.
              </div>
            )}
          </div>
        )}

        {!e.untracked && item.amount != null && <ResultPreview name={e.name || item.name} amount={item.amount} unit={e.unit} per100={cleanPer} tag="USER" />}
        <button onClick={onManual} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--primary)', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, padding: '4px 0', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Icon name="search" size={14} color="var(--primary)" /> Stattdessen aus Katalog zuordnen
        </button>
      </div>
    );
  }

  // ── ResolvePane: the orchestrating body (state machine for one item) ──
  function ResolvePane({ item, state, proposal, showConfidence, initialManual, context = 'import', onConfirm, onDiscard, onRetry, onClose }) {
    const isCreate = context === 'create';
    const isNew = proposal && proposal.verdict === 'new-food';
    const [draft, setDraft] = useState(() => isNew
      ? { name: proposal.entry.name, unit: proposal.entry.unit, untracked: !!proposal.entry.untracked, per100: { ...proposal.entry.per100 } }
      : null);
    const [manual, setManual] = useState(!!initialManual);

    // build & emit the resolved row
    function confirmNewFood() {
      const per100 = { kcal: Number(draft.per100.kcal) || 0, p: Number(draft.per100.p) || 0, c: Number(draft.per100.c) || 0, f: Number(draft.per100.f) || 0 };
      if (isCreate) {
        onConfirm({ key: slug(draft.name), name: draft.name, unit: draft.unit, per100, untracked: !!draft.untracked, source: 'USER' }, 'new-food');
        return;
      }
      onConfirm({
        key: slug(draft.name), name: draft.name, unit: draft.unit, per100,
        amount: draft.untracked ? 0 : item.amount, note: item.note || '', untracked: !!draft.untracked,
        piece: null, free: draft.untracked ? { qty: String(item.amount || 1), unit: item.unit } : null, source: 'USER',
      }, 'new-food');
    }
    function confirmSynonym() {
      const food = D.FOODS[proposal.foodKey];
      onConfirm({
        key: proposal.foodKey, name: food.name, unit: food.unit, per100: food.per100,
        amount: item.amount, note: item.note || '', untracked: !!food.untracked, piece: null, free: null, source: 'FOODS',
      }, 'synonym-of');
    }
    function pickManual(f) {
      if (isCreate) {
        onConfirm({ key: f.key, name: f.name, unit: f.unit, per100: f.per100, untracked: !!f.untracked, source: 'FOODS' }, 'manual');
        return;
      }
      onConfirm({
        key: f.key, name: f.name, unit: f.unit, per100: f.per100,
        amount: f.untracked ? 0 : item.amount, note: item.note || '', untracked: !!f.untracked,
        piece: null, free: f.untracked ? { qty: String(item.amount || 1), unit: item.unit } : null, source: 'FOODS',
      }, 'manual');
    }

    let body, footer;
    if (manual) {
      body = <ManualMatch item={item} onPick={pickManual} onBack={() => setManual(false)} />;
    } else if (state === 'loading') {
      body = <LoadingState />;
    } else if (state === 'error') {
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Eyebrow icon="info" color="var(--error)">Vorschlag nicht verfügbar</Eyebrow>
          <p className="fc-muted" style={{ fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>Die KI konnte gerade keinen Vorschlag laden. Du kannst es erneut versuchen oder die Zutat manuell zuordnen.</p>
          <button className="fc-btn fc-btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={onRetry}><Icon name="reset" size={15} /> Erneut versuchen</button>
        </div>
      );
      footer = <FallbackActions onManual={() => setManual(true)} onDiscard={onDiscard} />;
    } else if (!proposal || proposal.verdict === 'skip') {
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Eyebrow icon="info" color="var(--text-3)">Kein KI-Vorschlag</Eyebrow>
          <p className="fc-muted" style={{ fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>
            Für „{item.name}" gibt es keinen sicheren Vorschlag{proposal && proposal.reason ? ` (${proposal.reason})` : ''}. Ordne die Zutat aus dem Katalog zu oder entferne sie.
          </p>
        </div>
      );
      footer = <FallbackActions onManual={() => setManual(true)} onDiscard={onDiscard} />;
    } else {
      body = <ProposalContent item={item} proposal={proposal} draft={draft} setDraft={setDraft} showConfidence={showConfidence} aiAssisted={!isCreate} onManual={() => setManual(true)} />;
      footer = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="fc-btn fc-btn-ghost" style={{ flex: 1, height: 50 }} onClick={onClose}>Abbrechen</button>
            <button className="fc-btn fc-btn-primary" style={{ flex: 1.5, height: 50 }} onClick={isNew ? confirmNewFood : confirmSynonym}>
              <Icon name="check" size={17} /> {isCreate ? 'Anlegen & weiter' : 'Bestätigen & einfügen'}
            </button>
          </div>
          <p className="fc-faint" style={{ fontSize: 11.5, lineHeight: 1.45, margin: 0, textAlign: 'center' }}>
            {isNew ? 'Wird in deiner Lebensmittel-Bibliothek gespeichert · sofort durchsuchbar' : 'Synonym wird gelernt · künftig automatisch erkannt'}
          </p>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {context === 'import' && (
          <div className="fc-card" style={{ padding: '12px 14px', background: 'linear-gradient(180deg, var(--accent-soft), var(--card))' }}>
            <OriginalLine item={item} />
          </div>
        )}
        {body}
        {footer}
      </div>
    );
  }

  // sheet wrapper
  function ResolveSheet({ item, ...rest }) {
    return (
      <Sheet open={!!item} onClose={rest.onClose} title={item ? `„${item.name}" zuordnen` : ''}>
        {item && <ResolvePane key={item.id} item={item} {...rest} />}
      </Sheet>
    );
  }

  Object.assign(window, { ResolvePane, ResolveSheet });
})();
