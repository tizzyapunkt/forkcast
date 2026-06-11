/* forkcast — add-food bottom sheet (the fast-logging flow) */
(function () {
  const { useState } = React;
  const Icon = window.Icon;
  const { Sheet, Tabs, CatalogRow, IconBtn, fmt } = window;
  const D = window.FC_DATA;

  const QUICK_AMOUNTS = [25, 50, 100, 150, 200];

  // step 2: choose amount for a catalog food, with live macro preview
  function AmountStep({ item, onConfirm }) {
    const [amount, setAmount] = useState(100);
    const factor = amount / 100;
    const k = Math.round(item.kcal * factor);
    return (
      <div className="fc-anim-pop">
        <h3 style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.2, textWrap: 'pretty' }}>{item.name}</h3>
        <p className="fc-num fc-faint" style={{ fontSize: 13, marginTop: 4 }}>{item.kcal} kcal / 100{item.unit} · {fmt.macroStr(item.p, item.c, item.f)}</p>

        <label className="fc-label" style={{ marginTop: 18 }}>Menge ({item.unit})</label>
        <input className="fc-input" type="number" inputMode="decimal" autoFocus value={amount}
          onChange={(e) => setAmount(Number(e.target.value) || 0)} style={{ fontSize: 20, fontWeight: 700, textAlign: 'center' }} />
        <div style={{ display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
          {QUICK_AMOUNTS.map((a) => (
            <button key={a} onClick={() => setAmount(a)} className="fc-chip"
              style={{ cursor: 'pointer', border: amount === a ? '1px solid var(--accent)' : '1px solid transparent',
                background: amount === a ? 'var(--accent-soft)' : 'var(--muted)', color: amount === a ? 'var(--primary)' : 'var(--muted-fg)',
                padding: '7px 13px', fontSize: 13 }}>{a} {item.unit}</button>
          ))}
        </div>

        <div className="fc-card" style={{ marginTop: 18, padding: '14px 16px', background: 'var(--muted)', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="fc-num" style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)' }}>{k} <span style={{ fontSize: 15, fontWeight: 600 }}>kcal</span></span>
          <span className="fc-num fc-muted" style={{ fontSize: 13.5, fontWeight: 600 }}>{fmt.macroStr(item.p * factor, item.c * factor, item.f * factor)}</span>
        </div>

        <button className="fc-btn fc-btn-primary" style={{ width: '100%', marginTop: 16, height: 50 }}
          onClick={() => onConfirm({ id: D.nextId(), name: item.name, unit: item.unit, amount,
            per100: { kcal: item.kcal, p: item.p, c: item.c, f: item.f } })}>
          <Icon name="check" size={19} /> {amount} {item.unit} erfassen
        </button>
      </div>
    );
  }

  function SearchTab({ onPick }) {
    const [q, setQ] = useState('Brot');
    const results = q.trim() ? D.SEARCH_BROT : [];
    return (
      <div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Icon name="search" size={18} color="var(--text-3)" style={{ position: 'absolute', left: 12, top: 13 }} />
            <input className="fc-input" placeholder="Zutaten suchen…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 38 }} />
          </div>
          <button className="fc-btn fc-btn-soft" aria-label="Verpackung fotografieren" style={{ minWidth: 48, padding: 0 }}>
            <Icon name="camera" size={21} color="var(--primary)" />
          </button>
        </div>
        <div className="fc-divide" style={{ marginTop: 6 }}>
          {results.map((it, i) => <CatalogRow key={i} {...it} onClick={() => onPick(it)} />)}
          {results.length === 0 && <p className="fc-faint" style={{ fontSize: 14, padding: '14px 2px' }}>Tippe, um Zutaten zu suchen.</p>}
        </div>
      </div>
    );
  }

  function RecentTab({ onPick }) {
    const [q, setQ] = useState('');
    const list = D.RECENT.filter((x) => x.name.toLowerCase().includes(q.toLowerCase()));
    return (
      <div>
        <input className="fc-input" placeholder="Zuletzt verwendet filtern…" value={q} onChange={(e) => setQ(e.target.value)}
          style={{ marginTop: 6, background: 'var(--muted)', border: '1px solid transparent' }} />
        <div className="fc-divide" style={{ marginTop: 6 }}>
          {list.map((it, i) => <CatalogRow key={i} {...it} onClick={() => onPick(it)} />)}
        </div>
      </div>
    );
  }

  function RecipesTab({ onPick, onAddRecipe }) {
    const [q, setQ] = useState('');
    const list = D.RECIPES.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
    return (
      <div>
        <input className="fc-input" placeholder="Rezepte filtern…" value={q} onChange={(e) => setQ(e.target.value)}
          style={{ marginTop: 6, background: 'var(--muted)', border: '1px solid transparent' }} />
        <div className="fc-divide" style={{ marginTop: 6 }}>
          {list.map((rec) => {
            const t = D.recipeTotals(rec);
            return (
              <button key={rec.id} onClick={() => onPick(rec)} style={{ width: '100%', background: 'none', border: 'none',
                cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 2px', minHeight: 58 }}>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 15.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.name}</span>
                  <span className="fc-num fc-faint" style={{ fontSize: 12.5 }}>{rec.ingredients.length} Zut. · {rec.servings} Port.</span>
                </span>
                <span className="fc-num fc-muted" style={{ fontSize: 13, fontWeight: 600, flexShrink: 0 }}>{Math.round(t.kcal / rec.servings)} kcal/P</span>
                <Icon name="chevR" size={18} color="var(--text-3)" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function RecipePortionStep({ recipe, totals, onConfirm, expand }) {
    const [portions, setPortions] = useState(1);
    const per = portions / recipe.servings;
    function confirm() {
      if (expand) {
        // expand the recipe into individual ingredient entries, scaled to the chosen
        // portions and flagged with recipeRef so the plan can group/identify them.
        const factor = portions / recipe.servings;
        const round = (n) => Math.round(n * 10) / 10;
        const entries = recipe.ingredients.map((ing) => ({
          id: D.nextId(), key: ing.key, amount: round(ing.amount * factor),
          recipeRef: { id: recipe.id, name: recipe.name, portions },
        }));
        onConfirm(entries);
      } else {
        onConfirm({ id: D.nextId(), recipe: recipe.id, portions });
      }
    }
    return (
      <div className="fc-anim-pop">
        <h3 style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.2, textWrap: 'pretty' }}>{recipe.name}</h3>
        <p className="fc-faint" style={{ fontSize: 13, marginTop: 4 }}>Rezept ergibt {recipe.servings} Portionen</p>
        <label className="fc-label" style={{ marginTop: 18 }}>Zu erfassende Portionen</label>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}>{window.Stepper ? <window.Stepper value={portions} onChange={setPortions} /> : null}</div>
        <div className="fc-card" style={{ marginTop: 18, padding: '14px 16px', background: 'var(--muted)', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="fc-num" style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)' }}>{Math.round(totals.kcal * per)} <span style={{ fontSize: 15, fontWeight: 600 }}>kcal</span></span>
          <span className="fc-num fc-muted" style={{ fontSize: 13.5, fontWeight: 600 }}>{fmt.macroStr(totals.p * per, totals.c * per, totals.f * per)}</span>
        </div>
        {expand && (
          <p className="fc-faint" style={{ fontSize: 12.5, lineHeight: 1.4, marginTop: 10, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <Icon name="book" size={14} color="var(--primary)" style={{ flexShrink: 0, marginTop: 1 }} />
            Alle {recipe.ingredients.length} Zutaten werden einzeln in den Plan übernommen – jede lässt sich danach anpassen.
          </p>
        )}
        <button className="fc-btn fc-btn-primary" style={{ width: '100%', marginTop: 16, height: 50 }} onClick={confirm}>
          <Icon name="check" size={19} /> {expand ? 'Zutaten übernehmen' : 'Erfassen'}
        </button>
      </div>
    );
  }

  function QuickTab({ onAdd }) {
    const [f, setF] = useState({ name: '', kcal: '', p: '', c: '', fat: '' });
    const valid = f.name.trim() && f.kcal;
    const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
    return (
      <div style={{ marginTop: 8 }}>
        <label className="fc-label">Bezeichnung</label>
        <input className="fc-input" placeholder="z. B. Kaffee, Banane…" value={f.name} onChange={set('name')} />
        <label className="fc-label" style={{ marginTop: 14 }}>Kalorien (kcal)</label>
        <input className="fc-input" type="number" inputMode="numeric" placeholder="0" value={f.kcal} onChange={set('kcal')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 14 }}>
          <div><label className="fc-label">Eiweiß (g)</label><input className="fc-input" type="number" placeholder="—" value={f.p} onChange={set('p')} style={{ padding: '0 8px', textAlign: 'center' }} /></div>
          <div><label className="fc-label">KH (g)</label><input className="fc-input" type="number" placeholder="—" value={f.c} onChange={set('c')} style={{ padding: '0 8px', textAlign: 'center' }} /></div>
          <div><label className="fc-label">Fett (g)</label><input className="fc-input" type="number" placeholder="—" value={f.fat} onChange={set('fat')} style={{ padding: '0 8px', textAlign: 'center' }} /></div>
        </div>
        <button className={`fc-btn ${valid ? 'fc-btn-primary' : 'fc-btn-soft'}`} disabled={!valid} style={{ width: '100%', marginTop: 18, height: 50, opacity: valid ? 1 : .55 }}
          onClick={() => onAdd({ id: D.nextId(), quick: true, name: f.name.trim(), kcal: Number(f.kcal) || 0, p: Number(f.p) || 0, c: Number(f.c) || 0, f: Number(f.fat) || 0 })}>
          Eintrag hinzufügen
        </button>
      </div>
    );
  }

  function AddFoodSheet({ open, slot, onClose, onAdd, expandRecipes }) {
    const [tab, setTab] = useState('recent');
    const [amountItem, setAmountItem] = useState(null);
    const [recipeItem, setRecipeItem] = useState(null);
    function reset() { setAmountItem(null); setRecipeItem(null); }
    function finish(entry) { onAdd(entry); onClose(); setTimeout(reset, 300); }

    const TABS = [
      { id: 'search', label: 'Suche' }, { id: 'recent', label: 'Zuletzt' },
      { id: 'recipes', label: 'Rezepte' }, { id: 'quick', label: 'Schnell' },
    ];

    // a sub-step is open -> show a back arrow in the sheet header
    const onBack = amountItem ? () => setAmountItem(null)
      : recipeItem ? () => setRecipeItem(null) : null;

    return (
      <Sheet open={open} onClose={() => { onClose(); setTimeout(reset, 300); }}
        title={slot ? `Zu ${D.SLOT_LABEL[slot]} hinzufügen` : ''}
        onBack={onBack}
        right={<button onClick={() => { onClose(); setTimeout(reset, 300); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600, fontSize: 15 }}>Abbrechen</button>}>
        {amountItem ? (
          <AmountStep item={amountItem} onConfirm={finish} />
        ) : recipeItem ? (
          <RecipePortionStep recipe={recipeItem} totals={D.recipeTotals(recipeItem)} onConfirm={finish} expand={expandRecipes} />
        ) : (
          <>
            <Tabs tabs={TABS} active={tab} onChange={setTab} />
            {tab === 'search' && <SearchTab onPick={setAmountItem} />}
            {tab === 'recent' && <RecentTab onPick={setAmountItem} />}
            {tab === 'recipes' && <RecipesTab onPick={setRecipeItem} onAddRecipe={finish} />}
            {tab === 'quick' && <QuickTab onAdd={finish} />}
          </>
        )}
      </Sheet>
    );
  }

  window.AddFoodSheet = AddFoodSheet;
})();
