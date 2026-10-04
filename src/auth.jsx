import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authApi, session, setSignedOutHandler } from './api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [state, setState] = useState(() => session.load())

  // The axios interceptor calls this when a refresh fails.
  useEffect(() => {
    setSignedOutHandler(() => setState(null))
  }, [])

  const login = useCallback(async (username, password) => {
    const data = await authApi.login(username, password)
    const next = { user: data.user, tokens: data.tokens }
    session.save(next)
    setState(next)
  }, [])

  const register = useCallback(async (payload) => {
    const data = await authApi.register(payload)
    const next = { user: data.user, tokens: data.tokens }
    session.save(next)
    setState(next)
  }, [])

  const logout = useCallback(async () => {
    const s = session.load()
    if (s?.tokens?.refresh_token) await authApi.logout(s.tokens.refresh_token)
    session.clear()
    setState(null)
  }, [])

  const value = useMemo(
    () => ({ user: state?.user ?? null, isAuthenticated: Boolean(state?.tokens), login, register, logout }),
    [state, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
