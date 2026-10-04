import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './auth.jsx'
import { productApi, readError } from './api.js'

const CUR = import.meta.env.VITE_CURRENCY || 'PHP'
const money = (n) => {
  try { return new Intl.NumberFormat('en-PH', { style: 'currency', currency: CUR }).format(n) }
  catch { return `${CUR} ${Number(n).toFixed(2)}` }
}
const TONES = [
  ['#f6dcd2', '#e9b9ad'], ['#f3d3d6', '#dba2ab'], ['#efd9c8', '#d9b093'],
  ['#f4d8e0', '#d99fb2'], ['#ecd2c6', '#c99a8a'], ['#f7e2d9', '#e3b7a4'],
]
const tone = (s = '') => TONES[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length]

export default function App() {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <Shop /> : <Welcome />
}

/* ---------- sign in / create account ---------- */
function Welcome() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [err, setErr] = useState('')
  const [fields, setFields] = useState({})
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(''); setFields({})
    try {
      if (mode === 'register') await register(form)
      else await login(form.username, form.password)
    } catch (x) {
      const r = readError(x); setErr(r.message); setFields(r.fields)
    } finally { setBusy(false) }
  }

  return (
    <main className="welcome">
      <section className="arch">
        <div className="arch-top">
          <span className="eyebrow">Bloomblush</span>
          <h1>Your beauty<br /><em>shelf, curated.</em></h1>
        </div>
        <div className="arch-body">
          <div className="seg">
            <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => { setMode('login'); setErr('') }}>Sign in</button>
            <button type="button" className={mode === 'register' ? 'on' : ''} onClick={() => { setMode('register'); setErr('') }}>Create account</button>
          </div>
          {err && <p className="alert">{err}</p>}
          <form onSubmit={submit} noValidate>
            <label>{mode === 'login' ? 'Username or email' : 'Username'}
              <input value={form.username} onChange={set('username')} autoComplete="username" />
              {fields.username && <small>{fields.username}</small>}
            </label>
            {mode === 'register' && (
              <label>Email
                <input type="email" value={form.email} onChange={set('email')} autoComplete="email" />
                {fields.email && <small>{fields.email}</small>}
              </label>
            )}
            <label>Password
              <input type="password" value={form.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              {fields.password && <small>{fields.password}</small>}
            </label>
            <button className="btn" disabled={busy}>{busy ? 'One moment…' : mode === 'login' ? 'Enter the boutique' : 'Create my account'}</button>
          </form>
        </div>
      </section>
    </main>
  )
}

/* ---------- the shop ---------- */
const PAGE = 8

function Shop() {
  const { user, logout } = useAuth()
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState({ total: 0, page: 1, total_pages: 1 })
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [drawer, setDrawer] = useState(null)   // null | { product } (product null = new)
  const [del, setDel] = useState(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    const t = setTimeout(() => { setSearch(q.trim()); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [q])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const r = await productApi.list({ page, limit: PAGE, search })
      setItems(r.data); setMeta(r.meta)
      if (r.meta.page > r.meta.total_pages) setPage(r.meta.total_pages)
    } catch (x) { setError(readError(x).message) }
    finally { setLoading(false) }
  }, [page, search])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3200)
    return () => clearTimeout(t)
  }, [toast])

  const saved = (msg) => { setDrawer(null); setToast(msg); load() }
  const confirmDelete = async () => {
    try { await productApi.remove(del.id); setDel(null); setToast('Removed from your shelf'); load() }
    catch (x) { setDel(null); setError(readError(x).message) }
  }
  const low = items.filter((p) => p.quantity <= 5).length

  return (
    <div className="shop">
      <header className="bar">
        <div className="brand">Bloom<em>blush</em></div>
        <input className="find" placeholder="Search serums, lipsticks, creams…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="who">
          <span>{user?.username}{user?.role === 'admin' && <b className="chip">Admin · all products</b>}</span>
          <button className="ghost" onClick={logout}>Sign out</button>
        </div>
      </header>

      <section className="hero">
        <div>
          <span className="eyebrow">Inventory</span>
          <h2>The <em>beauty</em> collection</h2>
        </div>
        <div className="stats">
          <div><strong>{meta.total}</strong><span>products</span></div>
          <div><strong>{low}</strong><span>low on this page</span></div>
        </div>
        <button className="btn" onClick={() => setDrawer({ product: null })}>+ New product</button>
      </section>

      {error && <p className="alert wide">{error} <button className="link" onClick={load}>Try again</button></p>}

      {loading && !items.length ? <p className="note">Loading your shelf…</p>
        : !items.length ? <p className="note">{search ? `Nothing matches “${search}”.` : 'Your shelf is empty — add your first product.'}</p>
        : (
        <section className="grid">
          {items.map((p) => {
            const [a, b] = tone(p.product_name)
            const isLow = p.quantity <= 5
            return (
              <article className="card" key={p.id}>
                <div className="swatch" style={{ background: `linear-gradient(160deg, ${a}, ${b})` }}>
                  <span>{p.product_name.trim().charAt(0).toUpperCase()}</span>
                  <i className={isLow ? 'pill low' : 'pill'}>{p.quantity === 0 ? 'Sold out' : isLow ? `Only ${p.quantity} left` : `${p.quantity} in stock`}</i>
                </div>
                <h3>{p.product_name}</h3>
                <p className="desc">{p.description || 'No description yet.'}</p>
                <div className="row">
                  <strong className="price">{money(p.price)}</strong>
                  <span>
                    <button className="link" onClick={() => setDrawer({ product: p })}>Edit</button>
                    <button className="link danger" onClick={() => setDel(p)}>Delete</button>
                  </span>
                </div>
              </article>
            )
          })}
        </section>
      )}

      {meta.total_pages > 1 && (
        <nav className="pager">
          <button className="ghost" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>← Previous</button>
          <span>Page {meta.page} of {meta.total_pages}</span>
          <button className="ghost" disabled={page >= meta.total_pages || loading} onClick={() => setPage(page + 1)}>Next →</button>
        </nav>
      )}

      {drawer && <Drawer product={drawer.product} onClose={() => setDrawer(null)} onSaved={saved} />}
      {del && (
        <div className="veil" onClick={() => setDel(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Remove this product?</h3>
            <p><b>{del.product_name}</b> will be deleted from your shelf.</p>
            <div className="actions">
              <button className="ghost" onClick={() => setDel(null)}>Keep it</button>
              <button className="btn danger" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function Drawer({ product, onClose, onSaved }) {
  const [f, setF] = useState({
    product_name: product?.product_name ?? '', description: product?.description ?? '',
    price: product?.price ?? '', quantity: product?.quantity ?? '',
  })
  const [errs, setErrs] = useState({})
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    const local = {}
    if (!f.product_name.trim()) local.product_name = 'Please name the product.'
    if (f.price === '' || Number(f.price) < 0) local.price = 'Enter a price of 0 or more.'
    if (f.quantity === '' || !Number.isInteger(Number(f.quantity)) || Number(f.quantity) < 0) local.quantity = 'Enter a whole number of 0 or more.'
    setErrs(local); setMsg('')
    if (Object.keys(local).length) return
    setBusy(true)
    const body = { product_name: f.product_name.trim(), description: f.description.trim(), price: Number(f.price), quantity: Number(f.quantity) }
    try {
      if (product) await productApi.update(product.id, body); else await productApi.create(body)
      onSaved(product ? 'Product updated' : 'Added to your shelf')
    } catch (x) {
      const r = readError(x); setMsg(r.message); setErrs(r.fields)
    } finally { setBusy(false) }
  }

  return (
    <div className="veil" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <h3>{product ? 'Edit product' : 'New product'}</h3>
        {msg && <p className="alert">{msg}</p>}
        <form onSubmit={submit} noValidate>
          <label>Product name<input value={f.product_name} onChange={set('product_name')} autoFocus />{errs.product_name && <small>{errs.product_name}</small>}</label>
          <label>Description<textarea rows="4" value={f.description} onChange={set('description')} />{errs.description && <small>{errs.description}</small>}</label>
          <div className="two">
            <label>Price ({CUR})<input type="number" step="0.01" min="0" value={f.price} onChange={set('price')} />{errs.price && <small>{errs.price}</small>}</label>
            <label>In stock<input type="number" step="1" min="0" value={f.quantity} onChange={set('quantity')} />{errs.quantity && <small>{errs.quantity}</small>}</label>
          </div>
          <div className="actions">
            <button type="button" className="ghost" onClick={onClose}>Cancel</button>
            <button className="btn" disabled={busy}>{busy ? 'Saving…' : product ? 'Save changes' : 'Add product'}</button>
          </div>
        </form>
      </aside>
    </div>
  )
}
