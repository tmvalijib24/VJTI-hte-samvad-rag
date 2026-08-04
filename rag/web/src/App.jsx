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
import ReviewerPage from './pages/ReviewerPage'
import AdminPage from './pages/AdminPage'

// Inner app that has access to AuthContext
function InnerApp() {
  const { isAuthed, apiFetch, readJsonOrText, clearAuth, userRole, profileLoaded } = useAuth()

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
      const visibleSessions = userRole === 'desk_officer'
        ? sessions.filter(session => session.mode !== 'basic')
        : sessions
      setChatSessions(visibleSessions)
      return visibleSessions
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
      const nextMode = askMode === 'document' ? 'document' : 'basic'
      if (nextMode === 'basic' && userRole === 'desk_officer') {
        throw new Error('Basic chat is available only for reviewer/admin accounts.')
      }
      const payload = {
        mode: nextMode,
        document_ids: nextMode === 'document' ? selectedDocIds : [],
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
    if (nextMode === 'basic' && userRole === 'desk_officer') return
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

  useEffect(() => {
    if (userRole === 'desk_officer' && askMode === 'basic') {
      setAskMode('document')
    }
  }, [userRole, askMode])

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
    canManageDocuments: userRole !== 'desk_officer',
    canUseBasicChat: userRole !== 'desk_officer',
  }

  return (
    <>
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
              deleteSession={deleteSession}
            />
          } />
          <Route path="/chat" element={<ChatPage {...sharedProps} />} />
          <Route path="/documents" element={
            <DocumentsPage
              documents={documents}
              selectedDocIds={selectedDocIds}
              setSelectedDocIds={setSelectedDocIds}
              loadDocuments={loadDocuments}
              canManageDocuments={userRole !== 'desk_officer'}
              isBusy={isBusy}
              setIsBusy={setIsBusy}
              error={error}
              setError={setError}
              status={status}
              setStatus={setStatus}
            />
          } />
          <Route path="/reviewer" element={
            !profileLoaded ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading review workspace…</div>
            ) : userRole === 'legal_reviewer' || userRole === 'system_admin' ? (
              <ReviewerPage documents={documents} loadDocuments={loadDocuments} />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          } />
          <Route path="/admin" element={
            !profileLoaded ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading admin console…</div>
            ) : userRole === 'system_admin' ? (
              <AdminPage documents={documents} loadDocuments={loadDocuments} />
            ) : (
              <Navigate to="/dashboard" replace />
            )
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

      {/* Session rename/delete dialog - Globally available */}
      {sessionDialog && (
        <SessionDialog
          sessionDialog={sessionDialog}
          sessionTitleInput={sessionTitleInput}
          setSessionTitleInput={setSessionTitleInput}
          sessionDialogBusy={sessionDialogBusy}
          sessionTitle={sessionTitle}
          onClose={() => { if (!sessionDialogBusy) { setSessionDialog(null); setSessionTitleInput('') } }}
          onSubmit={async () => {
            if (!sessionDialog?.session?.id) return
            const session = sessionDialog.session
            const action = sessionDialog.type
            setSessionDialogBusy(true)
            setError('')
            try {
              if (action === 'rename') {
                const title = sessionTitleInput.trim()
                if (!title) throw new Error('Title cannot be empty.')
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
                setSessionDialog(null)
                setSessionTitleInput('')
                const sessions = await loadSessionList()
                if (sessionId === session.id) {
                  const latest = sessions?.[0]
                  if (latest?.id) {
                    await openSession(latest)
                  } else {
                    setSessionId(null)
                    setMessages([{ id: crypto.randomUUID(), role: 'assistant', content: defaultAssistantMessage(askMode, selectedDocIds.length) }])
                  }
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
          }}
        />
      )}
    </>
  )
}

function SessionDialog({ sessionDialog, sessionTitleInput, setSessionTitleInput, sessionDialogBusy, sessionTitle, onClose, onSubmit }) {
  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-background/80 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="bg-card border border-border/50 rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-semibold text-foreground">
            {sessionDialog.type === 'rename' ? 'Rename conversation' : 'Delete conversation'}
          </div>
        </div>

        {sessionDialog.type === 'rename' ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Choose a new title for this conversation.</p>
            <input
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              type="text"
              value={sessionTitleInput}
              onChange={e => setSessionTitleInput(e.target.value)}
              autoFocus
              maxLength={200}
              placeholder="Conversation title"
              disabled={sessionDialogBusy}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mb-4">
            This will permanently delete "{sessionTitle(sessionDialog.session)}" and all of its messages.
          </p>
        )}

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border/50">
          <button className="px-4 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:bg-secondary/80 transition-colors" type="button" onClick={onClose} disabled={sessionDialogBusy}>
            Cancel
          </button>
          <button className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all" type="button" onClick={onSubmit} disabled={sessionDialogBusy}>
            {sessionDialog.type === 'rename' ? 'Save title' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
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
