import './App.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import brandLogo from './assets/hero.png'
import LandingPage from './components/LandingPage'

function App() {
  const [authMode, setAuthMode] = useState('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [authError, setAuthError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [accessToken, setAccessToken] = useState(localStorage.getItem('access_token') || '')
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem('refresh_token') || '')
  const [userInfo, setUserInfo] = useState(() => {
    const raw = localStorage.getItem('auth_user')
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  })
  const [askMode, setAskMode] = useState('document')
  const [documentId, setDocumentId] = useState(null)
  const [source, setSource] = useState(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const [url, setUrl] = useState('')
  const [file, setFile] = useState(null)

  const [messages, setMessages] = useState([
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      content:
        'Choose Ask from PDF/Text for document-grounded answers, or Basic Chat for general questions.',
    },
  ])
  const [question, setQuestion] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [chatSessions, setChatSessions] = useState([])
  const [sessionsBusy, setSessionsBusy] = useState(false)
  const [sessionDialog, setSessionDialog] = useState(null)
  const [sessionTitleInput, setSessionTitleInput] = useState('')
  const [sessionDialogBusy, setSessionDialogBusy] = useState(false)

  const listRef = useRef(null)
  const suppressAutoLoadRef = useRef(false)
  const isAuthed = Boolean(accessToken)

  useEffect(() => {
  fetch(`${API_URL}/health`).catch(() => {
    // ignore errors — this is just a best-effort wake-up ping
  })
}, [])

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages.length, isBusy])

  const canAsk = useMemo(() => {
    if (isBusy || question.trim().length === 0) return false
    if (askMode === 'document') return Boolean(documentId)
    return true
  }, [askMode, documentId, question, isBusy])

  function defaultAssistantMessage(nextMode, nextDocumentId) {
    if (nextMode === 'document') {
      return nextDocumentId
        ? 'Document mode is active. Ask about your ingested content.'
        : 'Ingest a file or URL first, then ask from PDF/Text.'
    }
    return 'Basic chat mode is active. Ask anything.'
  }

  function mapHistoryToMessages(history) {
    return (history || []).map((m) => ({
      id: m.id || crypto.randomUUID(),
      role: m.role,
      content: m.content,
      sources: Array.isArray(m.sources) ? m.sources : [],
    }))
  }

  function sessionTitle(session) {
    const raw = String(session?.title || '').trim()
    if (raw) return raw
    if (session?.mode === 'document') return 'Document chat'
    return 'Basic chat'
  }

  function sessionSubtitle(session) {
    const modeLabel = session?.mode === 'document' ? 'Doc mode' : 'Basic mode'
    if (!session?.updated_at) return modeLabel
    const dt = new Date(session.updated_at)
    if (Number.isNaN(dt.getTime())) return modeLabel
    const when = dt.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    return `${modeLabel} • ${when}`
  }

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

  function persistDocumentSelection(nextDocument) {
    const nextDocumentId = nextDocument?.id || ''
    const nextSource = nextDocument?.source || ''

    setDocumentId(nextDocumentId || null)
    setSource(nextSource || null)
  }

  function clearAuth() {
    setAccessToken('')
    setRefreshToken('')
    setUserInfo(null)
    setDocumentId(null)
    setSource(null)
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('auth_user')
    setSessionId(null)
    setChatSessions([])
    setMessages([
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content:
          'Choose Ask from PDF/Text for document-grounded answers, or Basic Chat for general questions.',
      },
    ])
  }

  function openRenameDialog(session) {
    setSessionDialog({ type: 'rename', session })
    setSessionTitleInput(sessionTitle(session))
  }

  function openDeleteDialog(session) {
    setSessionDialog({ type: 'delete', session })
    setSessionTitleInput('')
  }

  function closeSessionDialog() {
    if (sessionDialogBusy) return
    setSessionDialog(null)
    setSessionTitleInput('')
  }

  useEffect(() => {
    if (!isAuthed) return
    if (suppressAutoLoadRef.current) {
      suppressAutoLoadRef.current = false
      return
    }

    let cancelled = false

    async function bootstrapChat() {
      const sessions = await loadSessionList()
      if (cancelled) return

      const latest = sessions?.[0]
      if (!latest?.id) {
        setSessionId(null)
        setMessages([
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: defaultAssistantMessage('document', null),
          },
        ])
        return
      }

      await openSession(latest)
    }

    bootstrapChat()

    return () => {
      cancelled = true
    }
  }, [isAuthed])

  async function apiFetch(path, options = {}, retries = 1) {
  const headers = { ...(options.headers || {}) }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  try {
    let res = await fetch(`${API_URL}${path}`, { ...options, headers })
    if (res.status !== 401 || !refreshToken) return res

    const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!refreshRes.ok) {
      clearAuth()
      return res
    }

    const refreshPayload = await refreshRes.json()
    persistAuth(refreshPayload)

    const retryHeaders = { ...(options.headers || {}), Authorization: `Bearer ${refreshPayload.access_token}` }
    res = await fetch(`${API_URL}${path}`, { ...options, headers: retryHeaders })
    return res
  } catch (err) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 3000))
      return apiFetch(path, options, retries - 1)
    }
    throw err
  }
}

  async function loadSessionList() {
    if (!isAuthed) return
    setSessionsBusy(true)
    try {
      const res = await apiFetch('/chat/sessions?limit=50')
      const { json } = await readJsonOrText(res)
      if (!res.ok) throw new Error('Failed to load conversation list')
      const sessions = Array.isArray(json?.sessions) ? json.sessions : []
      setChatSessions(sessions)
      return sessions
    } catch {
      setChatSessions([])
      return []
    } finally {
      setSessionsBusy(false)
    }
  }

  async function openSession(session) {
    if (!session?.id) return
    setError('')
    setStatus('')
    setIsBusy(true)
    try {
      suppressAutoLoadRef.current = true
      if (session.mode === 'basic') {
        setAskMode('basic')
      } else {
        setAskMode('document')
        if (session.document_id) {
          persistDocumentSelection({ id: session.document_id, source: 'Restored from conversation' })
        } else {
          setDocumentId(null)
          setSource(null)
        }
      }

      setSessionId(session.id)
      const historyRes = await apiFetch(`/chat/history/${session.id}`)
      const { json: historyJson, text } = await readJsonOrText(historyRes)
      if (!historyRes.ok) throw new Error(historyJson?.detail || text || 'Failed to load chat history')

      const mapped = mapHistoryToMessages(historyJson?.messages)
      setMessages(
        mapped.length
          ? mapped
          : [
              {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: defaultAssistantMessage(session.mode, session.document_id),
              },
            ],
      )
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setIsBusy(false)
    }
  }

  async function renameSession(session) {
    openRenameDialog(session)
  }

  async function deleteSession(session) {
    openDeleteDialog(session)
  }

  async function submitSessionDialog() {
    if (!sessionDialog?.session?.id) return

    const session = sessionDialog.session
    const action = sessionDialog.type

    setSessionDialogBusy(true)
    setError('')
    try {
      if (action === 'rename') {
        const title = sessionTitleInput.trim()
        if (!title) {
          throw new Error('Title cannot be empty.')
        }

        const res = await apiFetch(`/chat/sessions/${session.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title }),
        })
        const { json, text } = await readJsonOrText(res)
        if (!res.ok) throw new Error(json?.detail || text || 'Failed to rename chat session')
      } else {
        const res = await apiFetch(`/chat/sessions/${session.id}`, { method: 'DELETE' })
        const { json, text } = await readJsonOrText(res)
        if (!res.ok) throw new Error(json?.detail || text || 'Failed to delete chat session')

        const wasActive = sessionId === session.id
        setSessionDialog(null)
        setSessionTitleInput('')
        await loadSessionList()

        if (wasActive) {
          setSessionId(null)
          await loadLatestSession(askMode, documentId)
        }
        return
      }

      setSessionDialog(null)
      setSessionTitleInput('')
      await loadSessionList()
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setSessionDialogBusy(false)
    }
  }

  async function loadLatestSession(nextMode, nextDocumentId) {
    try {
      const sessions = await loadSessionList()
      const latest = sessions?.[0]
      if (!latest?.id) {
        setSessionId(null)
        setMessages([
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: defaultAssistantMessage(nextMode, nextDocumentId),
          },
        ])
        return
      }

      await openSession(latest)
    } catch {
      setSessionId(null)
      setMessages([
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: defaultAssistantMessage(nextMode, nextDocumentId),
        },
      ])
    }
  }

  function switchAskMode(nextMode) {
    if (nextMode === askMode) return
    setError('')
    setStatus('')
    setAskMode(nextMode)
    setSessionId(null)
    setMessages([
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: defaultAssistantMessage(nextMode, documentId),
      },
    ])
  }

  async function startNewChat() {
    setError('')
    setStatus('')
    setDocumentId(null)
    setSource(null)
    try {
      const payload = { mode: askMode === 'document' ? 'document' : 'basic' }
      const res = await apiFetch('/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const { json, text } = await readJsonOrText(res)
      if (!res.ok) throw new Error(json?.detail || text || 'Failed to create chat session')
      setSessionId(json.id)
      setMessages([
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: defaultAssistantMessage(askMode, null),
        },
      ])
      await loadSessionList()
    } catch (e) {
      setError(e.message || String(e))
    }
  }

  async function submitAuth(e) {
  e.preventDefault()
  setAuthError('')
  setAuthBusy(true)
  try {
    const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register'
    const payload =
      authMode === 'login'
        ? { email: authEmail, password: authPassword }
        : { email: authEmail, password: authPassword, full_name: authName }

    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const { json, text } = await readJsonOrText(res)
    if (!res.ok) throw new Error(json?.detail || text || `Auth failed (HTTP ${res.status})`)
    persistAuth(json)
    setAuthPassword('')
  } catch (err) {
    setAuthError(err.message || String(err))
  } finally {
    setAuthBusy(false)
  }
}

  async function readJsonOrText(res) {
    const text = await res.text()
    if (!text) return { json: null, text: '' }
    try {
      return { json: JSON.parse(text), text }
    } catch {
      return { json: null, text }
    }
  }

  async function ingestUrl() {
    setError('')
    setStatus('')
    if (!url.trim()) {
      setError('Please enter a URL.')
      return
    }
    setIsBusy(true)
    setStatus('Ingesting website…')
    try {
      const authRes = await apiFetch('/ingest/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const { json, text } = await readJsonOrText(authRes)
      if (!authRes.ok) throw new Error(json?.detail || text || `Failed to ingest URL (HTTP ${authRes.status}).`)
      persistDocumentSelection({ id: json.document_id, source: json.source })
      setSessionId(null)
      setMessages([
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: defaultAssistantMessage('document', json.document_id),
        },
      ])
      setStatus(`Ingested: ${json.source} (${json.chunk_count} chunks)`)
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setIsBusy(false)
    }
  }

  async function ingestFile() {
    setError('')
    setStatus('')
    if (!file) {
      setError('Please choose a file.')
      return
    }
    setIsBusy(true)
    setStatus('Uploading and ingesting file…')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await apiFetch('/ingest/file', { method: 'POST', body: form })
      const { json, text } = await readJsonOrText(res)
      if (!res.ok) throw new Error(json?.detail || text || `Failed to ingest file (HTTP ${res.status}).`)
      persistDocumentSelection({ id: json.document_id, source: json.source })
      setSessionId(null)
      setMessages([
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: defaultAssistantMessage('document', json.document_id),
        },
      ])
      setStatus(`Ingested: ${json.source} (${json.chunk_count} chunks)`)
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setIsBusy(false)
    }
  }

  async function sendQuestion() {
    const q = question.trim()
    if (askMode === 'document' && !documentId) {
      setError('Ingest something first (file or URL).')
      return
    }
    if (!q) return

    setError('')
    setStatus('')
    setQuestion('')

    const userMsg = { id: crypto.randomUUID(), role: 'user', content: q }
    setMessages((m) => [...m, userMsg])

    setIsBusy(true)
    try {
      const endpoint = askMode === 'document' ? '/ask' : '/chat/basic'
      const payload =
        askMode === 'document'
          ? { document_id: documentId, question: q, top_k: 10, session_id: sessionId }
          : { message: q, session_id: sessionId }

      const authRes = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const { json, text } = await readJsonOrText(authRes)
      if (!authRes.ok) throw new Error(json?.detail || text || `Failed to answer (HTTP ${authRes.status}).`)

      const assistantMsg = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: json.answer,
        sources: Array.isArray(json.sources) ? json.sources : [],
      }
      if (json.session_id) setSessionId(json.session_id)
      setMessages((m) => [...m, assistantMsg])
      await loadSessionList()
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Error: ${e.message || String(e)}`,
          isError: true,
        },
      ])
    } finally {
      setIsBusy(false)
    }
  }

  if (!isAuthed) {
    return (
      <LandingPage
        brandLogo={brandLogo}
        authMode={authMode}
        setAuthMode={setAuthMode}
        submitAuth={submitAuth}
        authName={authName}
        setAuthName={setAuthName}
        authEmail={authEmail}
        setAuthEmail={setAuthEmail}
        authPassword={authPassword}
        setAuthPassword={setAuthPassword}
        authBusy={authBusy}
        authError={authError}
      />
    )
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebarInner">
          <div className="brand">
            <img className="brandLogo" src={brandLogo} alt="Brand logo" />
            <div>
              <div className="brandTitle">RAGNexus</div>
              <div className="brandSub">{userInfo?.email || 'Authenticated user'}</div>
            </div>
            <button className="logoutBtn" type="button" onClick={clearAuth}>
              Logout
            </button>
          </div>

          <button className="btn sidebarNewChat" type="button" onClick={startNewChat} disabled={isBusy}>
            New chat
          </button>

          <div className="historyCard">
            <div className="historyHead">
              <div className="cardTitle">Conversations</div>
              <button className="historyRefresh" type="button" onClick={loadSessionList} disabled={sessionsBusy || isBusy}>
                Refresh
              </button>
            </div>
            <div className="historyList">
              {chatSessions.length ? (
                chatSessions.map((s) => (
                  <div
                    key={s.id}
                    className={`historyItem ${sessionId === s.id ? 'active' : ''}`}
                  >
                    <button
                      className="historyMain"
                      type="button"
                      onClick={() => openSession(s)}
                      disabled={isBusy}
                    >
                      <div className="historyTitle">{sessionTitle(s)}</div>
                      <div className="historyMeta">{sessionSubtitle(s)}</div>
                    </button>
                    <div className="historyActions">
                      <button
                        className="historyActionBtn"
                        type="button"
                        onClick={() => renameSession(s)}
                        disabled={isBusy}
                      >
                        Rename
                      </button>
                      <button
                        className="historyActionBtn danger"
                        type="button"
                        onClick={() => deleteSession(s)}
                        disabled={isBusy}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="historyEmpty">No previous chats yet.</div>
              )}
            </div>
          </div>

          <div className="modeCard">
            <div className="cardTitle">Ask Mode</div>
            <div className="modeToggle" role="tablist" aria-label="Ask mode">
              <button
                className={`modeBtn ${askMode === 'document' ? 'active' : ''}`}
                onClick={() => switchAskMode('document')}
                type="button"
              >
                Ask from PDF/Text
              </button>
              <button
                className={`modeBtn ${askMode === 'basic' ? 'active' : ''}`}
                onClick={() => switchAskMode('basic')}
                type="button"
              >
                Basic Chat
              </button>
            </div>
            <p className="modeHint">
              {askMode === 'document'
                ? 'Answers are retrieved only from your ingested document.'
                : 'Use this for general chat questions.'}
            </p>
          </div>

          <div className="card">
            <div className="cardTitle">Ingest</div>

            <div className="field">
              <label>Upload file (PDF/TXT/CSV)</label>
              <input
                type="file"
                accept=".pdf,.txt,.csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                disabled={isBusy}
              />
              <button className="btn" onClick={ingestFile} disabled={isBusy || !file}>
                Ingest file
              </button>
            </div>

            <div className="divider" />

            <div className="field">
              <label>Website URL</label>
              <input
                type="url"
                placeholder="https://example.com/docs"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isBusy}
              />
              <button className="btn" onClick={ingestUrl} disabled={isBusy || !url.trim()}>
                Ingest URL
              </button>
            </div>
          </div>

          <div className="card">
            <div className="cardTitle">Active document</div>
            <div className="kv">
              <div className="k">document_id</div>
              <div className="v mono">{documentId || '—'}</div>
            </div>
            <div className="kv">
              <div className="k">source</div>
              <div className="v">{source || '—'}</div>
            </div>
            {documentId ? (
              <div className="note ok">This document is loaded from your saved uploads and does not need to be ingested again.</div>
            ) : null}
            {status ? <div className="note ok">{status}</div> : null}
            {error ? <div className="note err">{error}</div> : null}
          </div>
        </div>
      </aside>

      <main className="chat">
        <header className="chatHeader">
          <div className="chatTitle">Chat Workspace</div>
          <div className="chatHint">
            {askMode === 'document'
              ? documentId
                ? 'Document mode is on: answers come only from your ingested source.'
                : 'Ingest a file or URL, then ask from PDF/Text.'
              : 'Basic chat mode is on: ask general questions.'}
          </div>
        </header>

        <div className="messages" ref={listRef}>
          {messages.map((m) => (
            <div key={m.id} className={`msgRow ${m.role}`}>
              <div className={`msg ${m.isError ? 'error' : ''}`}>
                <div className="msgRole">{m.role === 'user' ? 'You' : 'Assistant'}</div>
                <div className="msgText">{m.content}</div>

                {m.role === 'assistant' && m.sources?.length ? (
                  <div className="sources">
                    <div className="sourcesTitle">Sources</div>
                    <ol className="sourcesList">
                      {m.sources.map((s, idx) => (
                        <li key={s.chunk_id || idx} className="sourceItem">
                          <div className="sourceTop">
                            <span className="pill">{s.source || 'unknown source'}</span>
                            {s.page_number !== null && s.page_number !== undefined ? (
                              <span className="pill">page {s.page_number}</span>
                            ) : null}
                          </div>
                          <div className="sourceText mono">{String(s.text || '').slice(0, 260)}{String(s.text || '').length > 260 ? '…' : ''}</div>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
              </div>
            </div>
          ))}

          {isBusy ? (
            <div className="msgRow assistant">
              <div className="msg">
                <div className="msgRole">Assistant</div>
                <div className="msgText muted">Working…</div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="composer">
          <textarea
            className="input"
            placeholder={
              askMode === 'document'
                ? documentId
                  ? 'Ask from your ingested document…'
                  : 'Ingest something first…'
                : 'Say hi or hello…'
            }
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') sendQuestion()
            }}
            disabled={isBusy}
          />
          <button className="btn primary" onClick={sendQuestion} disabled={!canAsk}>
            {askMode === 'document' ? 'Ask from PDF/Text' : 'Send'}
          </button>
        </div>
      </main>

      {sessionDialog ? (
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="session-dialog-title">
          <div className="modalCard">
            <div className="modalHeader">
              <div id="session-dialog-title" className="modalTitle">
                {sessionDialog.type === 'rename' ? 'Rename conversation' : 'Delete conversation'}
              </div>
              <button className="modalClose" type="button" onClick={closeSessionDialog} disabled={sessionDialogBusy}>
                Close
              </button>
            </div>

            {sessionDialog.type === 'rename' ? (
              <>
                <p className="modalBodyText">Choose a new title for this conversation.</p>
                <input
                  className="modalInput"
                  type="text"
                  value={sessionTitleInput}
                  onChange={(e) => setSessionTitleInput(e.target.value)}
                  autoFocus
                  maxLength={200}
                  placeholder="Conversation title"
                  disabled={sessionDialogBusy}
                />
              </>
            ) : (
              <p className="modalBodyText">
                This will permanently delete {sessionTitle(sessionDialog.session)} and all of its messages.
              </p>
            )}

            <div className="modalActions">
              <button className="btn" type="button" onClick={closeSessionDialog} disabled={sessionDialogBusy}>
                Cancel
              </button>
              <button className="btn primary" type="button" onClick={submitSessionDialog} disabled={sessionDialogBusy}>
                {sessionDialog.type === 'rename' ? 'Save title' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
