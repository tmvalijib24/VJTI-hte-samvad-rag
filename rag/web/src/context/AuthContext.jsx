import { createContext, useContext, useState, useCallback } from 'react'

const AuthContext = createContext(null)

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(localStorage.getItem('access_token') || '')
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem('refresh_token') || '')
  const [userInfo, setUserInfo] = useState(() => {
    const raw = localStorage.getItem('auth_user')
    if (!raw) return null
    try { return JSON.parse(raw) } catch { return null }
  })

  const isAuthed = Boolean(accessToken)

  function persistAuth(payload) {
    const nextAccess = payload?.access_token || ''
    const nextRefresh = payload?.refresh_token || ''
    const nextUser = payload?.user || null
    setAccessToken(nextAccess)
    setRefreshToken(nextRefresh)
    setUserInfo(nextUser)
    localStorage.setItem('access_token', nextAccess)
    localStorage.setItem('refresh_token', nextRefresh)
    localStorage.setItem('auth_user', JSON.stringify(nextUser || {}))
  }

  const clearAuth = useCallback(() => {
    setAccessToken('')
    setRefreshToken('')
    setUserInfo(null)
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('auth_user')
  }, [])

  async function readJsonOrText(res) {
    const text = await res.text()
    if (!text) return { json: null, text: '' }
    try { return { json: JSON.parse(text), text } } catch { return { json: null, text } }
  }

  const apiFetch = useCallback(async (path, options = {}, _retries = 1) => {
    const headers = { ...(options.headers || {}) }
    // Read current token directly from localStorage to get the freshest value
    const currentToken = localStorage.getItem('access_token') || ''
    if (currentToken) headers.Authorization = `Bearer ${currentToken}`

    try {
      let res = await fetch(`${API_URL}${path}`, { ...options, headers })
      if (res.status !== 401) return res

      const currentRefresh = localStorage.getItem('refresh_token') || ''
      if (!currentRefresh) return res

      const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: currentRefresh }),
      })

      if (!refreshRes.ok) { clearAuth(); return res }

      const refreshPayload = await refreshRes.json()
      persistAuth(refreshPayload)

      const retryHeaders = { ...(options.headers || {}), Authorization: `Bearer ${refreshPayload.access_token}` }
      res = await fetch(`${API_URL}${path}`, { ...options, headers: retryHeaders })
      return res
    } catch (err) {
      if (_retries > 0) {
        await new Promise(r => setTimeout(r, 3000))
        return apiFetch(path, options, _retries - 1)
      }
      throw err
    }
  }, [clearAuth])

  return (
    <AuthContext.Provider value={{
      accessToken, refreshToken, userInfo,
      isAuthed, persistAuth, clearAuth, apiFetch, readJsonOrText, API_URL
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
