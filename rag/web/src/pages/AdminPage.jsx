import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Card } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { DocumentReviewPanel } from '../components/documents/DocumentReviewPanel'
import { openDocumentWithAuth } from '../lib/documentActions'

const ROLE_OPTIONS = [
  { value: 'system_admin', label: 'System Admin' },
  { value: 'legal_reviewer', label: 'Legal Reviewer' },
  { value: 'desk_officer', label: 'Desk Officer' },
]

export default function AdminPage({ documents, loadDocuments }) {
  const { apiFetch, readJsonOrText } = useAuth()
  const [selectedId, setSelectedId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [users, setUsers] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [userDrafts, setUserDrafts] = useState({})

  const orderedDocs = useMemo(() => {
    return [...documents].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
  }, [documents])

  const selectedDocument = orderedDocs.find(doc => doc.id === selectedId) || orderedDocs[0] || null

  useEffect(() => {
    if (!orderedDocs.length) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !orderedDocs.some(doc => doc.id === selectedId)) {
      const firstPending = orderedDocs.find(doc => doc.status === 'pending_review') || orderedDocs[0]
      setSelectedId(firstPending?.id || null)
    }
  }, [orderedDocs, selectedId])

  async function loadAdminData() {
    setBusy(true)
    setError('')
    try {
      const [usersRes, auditRes] = await Promise.all([
        apiFetch('/admin/users'),
        apiFetch('/admin/audit-logs?limit=50'),
      ])

      const usersParsed = await readJsonOrText(usersRes)
      const auditParsed = await readJsonOrText(auditRes)

      if (!usersRes.ok) throw new Error(usersParsed.json?.detail || usersParsed.text || 'Failed to load users')
      if (!auditRes.ok) throw new Error(auditParsed.json?.detail || auditParsed.text || 'Failed to load audit logs')

      const nextUsers = Array.isArray(usersParsed.json?.users) ? usersParsed.json.users : []
      setUsers(nextUsers)
      setUserDrafts(Object.fromEntries(nextUsers.map(user => [user.id, { role: user.role, is_active: user.is_active, full_name: user.full_name || '' }])) )
      setAuditLogs(Array.isArray(auditParsed.json?.logs) ? auditParsed.json.logs : [])
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    loadAdminData()
  }, [])

  async function saveMetadata(document, form) {
    if (!document?.id) return
    setBusy(true)
    setError('')
    setStatus('Saving metadata…')
    try {
      const res = await apiFetch(`/documents/${document.id}/metadata`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          department: form.department,
          document_number: form.document_number,
          document_date: form.document_date || null,
          category: form.category,
          language: form.language,
        }),
      })
      const { json, text } = await readJsonOrText(res)
      if (!res.ok) throw new Error(json?.detail || text || `Failed to save metadata (HTTP ${res.status}).`)
      setStatus('Metadata updated.')
      await loadDocuments()
      setSelectedId(json.id)
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  async function reviewDocument(document, nextStatus, reviewNotes) {
    if (!document?.id) return
    setBusy(true)
    setError('')
    setStatus(nextStatus === 'approved' ? 'Approving document…' : 'Rejecting document…')
    try {
      const res = await apiFetch(`/documents/${document.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, review_notes: reviewNotes || '' }),
      })
      const { json, text } = await readJsonOrText(res)
      if (!res.ok) throw new Error(json?.detail || text || `Failed to update review state (HTTP ${res.status}).`)
      setStatus(`Document ${nextStatus}.`)
      await loadDocuments()
      await loadAdminData()
      setSelectedId(json.id)
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  async function deleteDocument(document) {
    if (!document?.id) return
    if (!window.confirm(`Delete ${document.title || document.source}? This removes the document and its chunks.`)) return
    setBusy(true)
    setError('')
    setStatus('Deleting document…')
    try {
      const res = await apiFetch(`/documents/${document.id}`, { method: 'DELETE' })
      const { json, text } = await readJsonOrText(res)
      if (!res.ok) throw new Error(json?.detail || text || `Failed to delete document (HTTP ${res.status}).`)
      setStatus('Document deleted.')
      await loadDocuments()
      await loadAdminData()
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  async function openDocument(document) {
    await openDocumentWithAuth({ apiFetch, readJsonOrText, document, setError })
  }

  async function saveUser(userId) {
    const draft = userDrafts[userId]
    if (!draft) return
    setBusy(true)
    setError('')
    setStatus('Saving user…')
    try {
      const res = await apiFetch(`/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const { json, text } = await readJsonOrText(res)
      if (!res.ok) throw new Error(json?.detail || text || `Failed to update user (HTTP ${res.status}).`)
      setStatus('User updated.')
      await loadAdminData()
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const pending = orderedDocs.filter(doc => doc.status === 'pending_review')
  const admins = users.filter(user => user.role === 'system_admin')
  const reviewers = users.filter(user => user.role === 'legal_reviewer')

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Console</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage users, review documents, and inspect audit logs.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="p-4"><div className="text-xs text-muted-foreground uppercase tracking-wider">Documents</div><div className="text-2xl font-bold mt-1">{orderedDocs.length}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground uppercase tracking-wider">Pending</div><div className="text-2xl font-bold mt-1">{pending.length}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground uppercase tracking-wider">Users</div><div className="text-2xl font-bold mt-1">{users.length}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground uppercase tracking-wider">Audit Logs</div><div className="text-2xl font-bold mt-1">{auditLogs.length}</div></Card>
        </div>

        {error && <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
        {status && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">{status}</div>}

        <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Documents</h2>
                <Button variant="outline" size="sm" onClick={loadAdminData} disabled={busy}>Refresh</Button>
              </div>
              <div className="space-y-2">
                {orderedDocs.length === 0 ? (
                  <Card className="p-6 border-dashed border-border/50 text-sm text-muted-foreground">No documents available.</Card>
                ) : orderedDocs.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedId(doc.id)}
                    className={`w-full text-left rounded-2xl border p-4 transition-all ${selectedId === doc.id ? 'border-primary bg-primary/5' : 'border-border/50 bg-card hover:bg-secondary/30'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{doc.title || doc.source}</div>
                        <div className="text-xs text-muted-foreground mt-1 truncate">{doc.department || 'No department'} · {doc.document_number || 'No document number'}</div>
                      </div>
                      <Badge variant={doc.status === 'approved' ? 'secondary' : doc.status === 'rejected' ? 'destructive' : 'outline'}>{doc.status?.replace('_', ' ')}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <DocumentReviewPanel
              document={selectedDocument}
              busy={busy}
              onSaveMetadata={saveMetadata}
              onReview={reviewDocument}
              onDelete={deleteDocument}
              onOpenDocument={openDocument}
            />
          </div>

          <div className="space-y-6">
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Users</h2>
                <Button variant="outline" size="sm" onClick={loadAdminData} disabled={busy}>Reload</Button>
              </div>
              <div className="space-y-3">
                {users.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No users loaded.</div>
                ) : users.map(user => (
                  <Card key={user.id} className="p-3 border-border/40">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{user.full_name || user.email}</div>
                          <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                        </div>
                        <Badge variant={user.role === 'system_admin' ? 'secondary' : user.role === 'legal_reviewer' ? 'outline' : 'default'}>{user.role}</Badge>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="text-xs text-muted-foreground">
                          Role
                          <select
                            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                            value={userDrafts[user.id]?.role || user.role}
                            onChange={e => setUserDrafts(d => ({ ...d, [user.id]: { ...(d[user.id] || {}), role: e.target.value } }))}
                          >
                            {ROLE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </label>
                        <label className="text-xs text-muted-foreground flex items-center gap-2 pt-5">
                          <input
                            type="checkbox"
                            checked={Boolean(userDrafts[user.id]?.is_active ?? user.is_active)}
                            onChange={e => setUserDrafts(d => ({ ...d, [user.id]: { ...(d[user.id] || {}), is_active: e.target.checked } }))}
                          />
                          Active account
                        </label>
                      </div>
                      <label className="text-xs text-muted-foreground block">
                        Full name
                        <Input
                          className="mt-1"
                          value={userDrafts[user.id]?.full_name ?? user.full_name ?? ''}
                          onChange={e => setUserDrafts(d => ({ ...d, [user.id]: { ...(d[user.id] || {}), full_name: e.target.value } }))}
                        />
                      </label>
                      <div className="flex justify-end">
                        <Button size="sm" onClick={() => saveUser(user.id)} disabled={busy}>Save</Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs text-muted-foreground">
                <div>Admins: {admins.length}</div>
                <div>Reviewers: {reviewers.length}</div>
              </div>
            </Card>

            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Audit Trail</h2>
                <Button variant="outline" size="sm" onClick={loadAdminData} disabled={busy}>Refresh</Button>
              </div>
              <div className="space-y-2 max-h-128 overflow-y-auto pr-1">
                {auditLogs.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No audit events yet.</div>
                ) : auditLogs.map(log => (
                  <div key={log.id} className="rounded-xl border border-border/40 bg-background/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium">{log.action}</div>
                      <div className="text-[10px] text-muted-foreground">{log.created_at ? new Date(log.created_at).toLocaleString() : ''}</div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">Target: {log.target_type || 'n/a'} {log.target_id || ''}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}