import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ProtectedRoute, GuestRoute } from './components/ProtectedRoute'
import { AuthLayout } from './layouts/AuthLayout'
import { PublicLayout } from './layouts/PublicLayout'
import LandingPage from './components/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import ChatPage from './pages/ChatPage'
import DocumentsPage from './pages/DocumentsPage'
import HistoryPage from './pages/HistoryPage'
import SettingsPage from './pages/SettingsPage'

// Inner app that has access to AuthContext
function InnerApp() {
  const { isAuthed, apiFetch, readJsonOrText, clearAuth } = useAuth()

  // ── Shared state (chat, sessions, documents) ──────────────────────────────
  const [askMode, setAskMode] = useState('document')
  const [documents, setDocuments] = useState([])
  const [selectedDocIds, setSelectedDocIds] = useState([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [messages, setMessages] = useState([
    { id: crypto.randomUUID(), role: 'assistant', content: 'Upload or select document(s) first, then ask questions.' },
  ])
  const [isBusy, setIsBusy] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [chatSessions, setChatSessions] = useState([])
  const [sessionDialog, setSessionDialog] = useState(null)
  const [sessionTitleInput, setSessionTitleInput] = useState('')
  const [sessionDialogBusy, setSessionDialogBusy] = useState(false)

  const suppressAutoLoadRef = useRef(false)

  // ── Helpers ───────────────────────────────────────────────────────────────

  function defaultAssistantMessage(nextMode, selectedCount) {
    if (nextMode === 'document') {
      return selectedCount > 0
        ? 'Document mode is active. Ask about your selected content.'
        : 'Upload or select document(s) first, then ask questions.'
    }
    return 'Basic chat mode is active. Ask anything.'
  }

  function mapHistoryToMessages(history) {
    return (history || []).map(m => ({
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

  // ── Data loaders ──────────────────────────────────────────────────────────

  async function loadDocuments() {
    if (!isAuthed) return
    try {
      const res = await apiFetch('/documents')
      const { json } = await readJsonOrText(res)
      if (res.ok) setDocuments(json.documents || [])
    } catch (e) {
      console.error('Failed to load documents:', e)
    }
  }

  async function loadSessionList() {
    if (!isAuthed) return []
    try {
      const res = await apiFetch('/chat/sessions?limit=50')
      const { json } = await readJsonOrText(res)
      if (!res.ok) throw new Error('Failed to load sessions')
      const sessions = Array.isArray(json?.sessions) ? json.sessions : []
      setChatSessions(sessions)
      return sessions
    } catch {
      setChatSessions([])
      return []
    }
  }

  async function openSession(session) {
    if (!session?.id) return
    setError('')
    setStatus('')
    setIsBusy(true)
    try {
      suppressAutoLoadRef.current = true
      let docCount = 0
      if (session.mode === 'basic') {
        setAskMode('basic')
        setSelectedDocIds([])
      } else {
        setAskMode('document')
        if (session.document_ids?.length) {
          setSelectedDocIds(session.document_ids)
          docCount = session.document_ids.length
        } else if (session.document_id) {
          setSelectedDocIds([session.document_id])
          docCount = 1
        } else {
          setSelectedDocIds([])
        }
      }
      setSessionId(session.id)
      const historyRes = await apiFetch(`/chat/history/${session.id}`)
      const { json: historyJson, text } = await readJsonOrText(historyRes)
      if (!historyRes.ok) throw new Error(historyJson?.detail || text || 'Failed to load chat history')

      const historyDocIds = historyJson?.session?.document_ids
      if (Array.isArray(historyDocIds) && historyDocIds.length > 0) {
        setSelectedDocIds(historyDocIds)
        docCount = historyDocIds.length
      }

      const mapped = mapHistoryToMessages(historyJson?.messages)
      setMessages(
        mapped.length
          ? mapped
          : [{ id: crypto.randomUUID(), role: 'assistant', content: defaultAssistantMessage(session.mode, docCount) }]
      )
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setIsBusy(false)
    }
  }

  async function startNewChat() {
    setError('')
    setStatus('')
    try {
      const payload = {
        mode: askMode === 'document' ? 'document' : 'basic',
        document_ids: askMode === 'document' ? selectedDocIds : [],
      }
      const res = await apiFetch('/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const { json, text } = await readJsonOrText(res)
      if (!res.ok) throw new Error(json?.detail || text || 'Failed to create chat session')
      setSessionId(json.id)
      setMessages([{ id: crypto.randomUUID(), role: 'assistant', content: defaultAssistantMessage(askMode, selectedDocIds.length) }])
      await loadSessionList()
    } catch (e) {
      setError(e.message || String(e))
    }
  }

  function switchAskMode(nextMode) {
    if (nextMode === askMode) return
    setError('')
    setStatus('')
    setAskMode(nextMode)
    setSessionId(null)
    setMessages([{ id: crypto.randomUUID(), role: 'assistant', content: defaultAssistantMessage(nextMode, selectedDocIds.length) }])
  }

  function renameSession(session) {
    setSessionDialog({ type: 'rename', session })
    setSessionTitleInput(sessionTitle(session))
  }

  function deleteSession(session) {
    setSessionDialog({ type: 'delete', session })
    setSessionTitleInput('')
  }

  // ── Bootstrap on auth ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!isAuthed) return
    loadDocuments()
    if (suppressAutoLoadRef.current) {
      suppressAutoLoadRef.current = false
      return
    }
    let cancelled = false
    async function bootstrap() {
      const sessions = await loadSessionList()
      if (cancelled) return
      const latest = sessions?.[0]
      if (!latest?.id) {
        setSessionId(null)
        setMessages([{ id: crypto.randomUUID(), role: 'assistant', content: defaultAssistantMessage('document', 0) }])
        return
      }
      await openSession(latest)
    }
    bootstrap()
    return () => { cancelled = true }
  }, [isAuthed])

  // Wake-up ping
  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
    fetch(`${API_URL}/health`).catch(() => {})
  }, [])

  // Shared props passed down to authenticated pages
  const sharedProps = {
    askMode,
    selectedDocIds,
    setSelectedDocIds,
    documents,
    loadDocuments,
    chatSessions,
    loadSessionList,
    sessionId,
    setSessionId,
    messages,
    setMessages,
    isBusy,
    setIsBusy,
    sessionDialog,
    setSessionDialog,
    sessionTitleInput,
    setSessionTitleInput,
    sessionDialogBusy,
    setSessionDialogBusy,
    openSession,
    defaultAssistantMessage,
    mapHistoryToMessages,
    sessionTitle,
    error,
    setError,
    status,
    setStatus,
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
      </Route>

      <Route element={<GuestRoute />}>
        <Route element={<PublicLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
      </Route>

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route
          element={
            <AuthLayout
              chatSessions={chatSessions}
              sessionId={sessionId}
              openSession={openSession}
              startNewChat={startNewChat}
              renameSession={renameSession}
              deleteSession={deleteSession}
              askMode={askMode}
              switchAskMode={switchAskMode}
            />
          }
        >
          <Route path="/dashboard" element={
            <DashboardPage
              chatSessions={chatSessions}
              documents={documents}
              openSession={openSession}
              askMode={askMode}
            />
          } />
          <Route path="/chat" element={<ChatPage {...sharedProps} />} />
          <Route path="/documents" element={
            <DocumentsPage
              documents={documents}
              selectedDocIds={selectedDocIds}
              setSelectedDocIds={setSelectedDocIds}
              loadDocuments={loadDocuments}
              isBusy={isBusy}
              setIsBusy={setIsBusy}
              error={error}
              setError={setError}
              status={status}
              setStatus={setStatus}
            />
          } />
          <Route path="/history" element={
            <HistoryPage chatSessions={chatSessions} openSession={openSession} />
          } />
          <Route path="/settings" element={<SettingsPage />} />
          {/* Catch-all redirect for authed users */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>

      {/* Catch-all for truly unknown paths */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <InnerApp />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
