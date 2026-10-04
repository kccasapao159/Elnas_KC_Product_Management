import axios from 'axios'

// All data goes through the LavaLust API - the browser never talks to the database.
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '')

const KEY = 'bloomblush.session'

export const session = {
  load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || null
    } catch {
      return null
    }
  },
  save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      /* storage unavailable - user will simply have to log in again */
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
  },
}

export const http = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000, // Render free instances can take a while to wake up
})

// Set by AuthProvider so the interceptors can tell React the user was signed out.
let onSignedOut = () => {}
export const setSignedOutHandler = (fn) => {
  onSignedOut = fn
}

// 1) attach the access token to every request
http.interceptors.request.use((config) => {
  const s = session.load()
  if (s?.tokens?.access_token) {
    config.headers.Authorization = `Bearer ${s.tokens.access_token}`
  }
  return config
})

// 2) on 401, try ONE refresh, then replay the request; otherwise sign out
let refreshing = null

http.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    const status = error.response?.status
    const isAuthCall = original?.url?.startsWith('/auth/')

    if (status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true
      const s = session.load()
      if (!s?.tokens?.refresh_token) {
        session.clear()
        onSignedOut()
        return Promise.reject(error)
      }

      // Another request may already have refreshed the tokens while this one was
      // in flight - then just replay with the newer access token.
      const sent = (original.headers.Authorization || '').replace('Bearer ', '')
      if (s.tokens.access_token && s.tokens.access_token !== sent) {
        original.headers.Authorization = `Bearer ${s.tokens.access_token}`
        return http(original)
      }

      try {
        // Refresh tokens rotate (single use), so share ONE refresh call between
        // all requests that failed at the same time.
        refreshing =
          refreshing ||
          axios
            .post(`${API_URL}/api/auth/refresh`, { refresh_token: s.tokens.refresh_token })
            .then((r) => {
              const tokens = r.data.tokens
              session.save({ ...(session.load() || s), tokens })
              return tokens
            })
            .finally(() => {
              refreshing = null
            })
        const tokens = await refreshing
        original.headers.Authorization = `Bearer ${tokens.access_token}`
        return http(original)
      } catch {
        session.clear()
        onSignedOut()
      }
    }
    return Promise.reject(error)
  },
)

/** Turn an axios error into { message, fields } for display. */
export function readError(err) {
  if (err.code === 'ECONNABORTED') {
    return { message: 'The server took too long to answer. Try again in a moment.', fields: {} }
  }
  if (!err.response) {
    return { message: 'Cannot reach the API. Check that it is running and VITE_API_URL is correct.', fields: {} }
  }
  const data = err.response.data || {}
  return { message: data.error || 'Something went wrong.', fields: data.errors || {} }
}

export const authApi = {
  login: (username, password) => http.post('/auth/login', { username, password }).then((r) => r.data),
  register: (payload) => http.post('/auth/register', payload).then((r) => r.data),
  logout: (refresh_token) => http.post('/auth/logout', { refresh_token }).catch(() => {}),
}

export const productApi = {
  list: (params) => http.get('/products', { params }).then((r) => r.data),
  create: (body) => http.post('/products', body).then((r) => r.data),
  update: (id, body) => http.put(`/products/${id}`, body).then((r) => r.data),
  remove: (id) => http.delete(`/products/${id}`).then((r) => r.data),
}
