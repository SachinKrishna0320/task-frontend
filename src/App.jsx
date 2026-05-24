import { useCallback, useState } from 'react';
import './App.css';

/** Use same host as the page in the browser (fixes EC2 deploy where localhost is wrong). */
function resolveApiBase() {
  const fromEnv = import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    if (
      !fromEnv ||
      fromEnv.includes('localhost') ||
      fromEnv.includes('127.0.0.1')
    ) {
      return `${protocol}//${hostname}:3001`;
    }
  }
  return fromEnv || 'http://localhost:3001';
}

const apiBase = resolveApiBase();

async function api(path, options) {
  const res = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

function formatStoredAt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function rowId(item) {
  return item._id != null ? String(item._id) : '';
}

export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [dataVisible, setDataVisible] = useState(false);
  const [selected, setSelected] = useState(() => new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api('/api/data');
      setItems(Array.isArray(data) ? data : []);
      setSelected(new Set());
    } catch (e) {
      setError(e.message || 'Could not reach the API');
      setItems([]);
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  async function showData() {
    setDataVisible(true);
    await load();
  }

  function hideData() {
    setDataVisible(false);
    setError(null);
    setSelected(new Set());
  }

  function toggleRow(id) {
    if (!id) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const allIds = items.map(rowId).filter(Boolean);
    setSelected((prev) => {
      if (allIds.length > 0 && allIds.every((id) => prev.has(id))) {
        return new Set();
      }
      return new Set(allIds);
    });
  }

  async function addItem(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api('/api/data', { method: 'POST', body: JSON.stringify({ name: trimmed }) });
      setName('');
      if (dataVisible) await load();
    } catch (e) {
      setError(e.message || 'Failed to add item');
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelected() {
    const ids = [...selected];
    if (ids.length === 0 || busy) return;
    const ok = window.confirm(`Delete ${ids.length} selected item(s)? This cannot be undone.`);
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await api('/api/data/delete', { method: 'POST', body: JSON.stringify({ ids }) });
      setSelected(new Set());
      await load();
    } catch (e) {
      setError(e.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  const selectableIds = items.map(rowId).filter(Boolean);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  return (
    <div className="app">
      <div className="app__glow app__glow--1" aria-hidden />
      <div className="app__glow app__glow--2" aria-hidden />

      <div className="app__inner">
        <header className="hero">
          <p className="hero__eyebrow">Three-tier workspace</p>
          <h1 className="hero__title">Item catalog</h1>
          <p className="hero__lead">
            Create rows in MongoDB, reveal them when you need them, select multiple entries, and remove
            them in one step.
          </p>
          <div className="hero__meta">
            <span className="badge">
              API <strong>{apiBase}</strong>
            </span>
            <span className="stack-pill">React · Vite · Express · MongoDB</span>
          </div>
        </header>

        <section className="panel">
          <div className="toolbar">
            {!dataVisible ? (
              <button type="button" className="btn btn--primary" onClick={showData} disabled={loading || busy}>
                View data
              </button>
            ) : (
              <>
                <button type="button" className="btn btn--ghost" onClick={hideData} disabled={busy}>
                  Hide data
                </button>
                <button
                  type="button"
                  className={`btn btn--danger ${!someSelected || loading ? 'btn--muted' : ''}`}
                  onClick={deleteSelected}
                  disabled={busy || !someSelected || loading}
                >
                  Delete selected
                </button>
                {someSelected && <span className="chip">{selected.size} selected</span>}
                <span className="toolbar__spacer" />
                {dataVisible && !loading && (
                  <span className="badge" style={{ opacity: 0.85 }}>
                    {items.length} row{items.length === 1 ? '' : 's'}
                  </span>
                )}
              </>
            )}
          </div>

          <form className="form-row" onSubmit={addItem}>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Type a new item name…"
              disabled={busy}
              aria-label="New item name"
            />
            <button type="submit" className="btn btn--primary" disabled={busy || !name.trim()}>
              Add item
            </button>
          </form>

          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}

          {dataVisible && (
            <div className="data-region">
              {loading ? (
                <div className="loading-block">
                  <span className="spinner" aria-hidden />
                  <span>Fetching latest rows…</span>
                </div>
              ) : items.length === 0 ? (
                <p className="empty-state">No rows yet. Add your first item above.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={toggleSelectAll}
                            disabled={busy}
                            title={allSelected ? 'Deselect all' : 'Select all'}
                            aria-label={allSelected ? 'Deselect all rows' : 'Select all rows'}
                          />
                        </th>
                        <th scope="col">#</th>
                        <th scope="col">Name</th>
                        <th scope="col">Stored at</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => {
                        const id = rowId(item);
                        const isSelected = id && selected.has(id);
                        return (
                          <tr
                            key={id || `${item.name}-${index}`}
                            className={isSelected ? 'row--selected' : undefined}
                          >
                            <td>
                              <input
                                type="checkbox"
                                checked={Boolean(id && selected.has(id))}
                                onChange={() => toggleRow(id)}
                                disabled={busy || !id}
                                aria-label={`Select ${item.name}`}
                              />
                            </td>
                            <td className="col-num">{index + 1}</td>
                            <td>{item.name}</td>
                            <td className="col-time">{formatStoredAt(item.createdAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <footer className="panel__footer">Selections reset after load or delete · Tip: hard-refresh if styles look cached</footer>
        </section>
      </div>
    </div>
  );
}
