import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Card } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { DocumentReviewPanel } from '../components/documents/DocumentReviewPanel'
import { openDocumentWithAuth } from '../lib/documentActions'

export default function ReviewerPage({ documents, loadDocuments }) {
  const { apiFetch, readJsonOrText } = useAuth()
  const [selectedId, setSelectedId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  const orderedDocs = useMemo(() => {
    return [...documents].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
  }, [documents])

  const pendingDocs = useMemo(() => orderedDocs.filter(doc => doc.status === 'pending_review'), [orderedDocs])
  const selectedDocument = pendingDocs.find(doc => doc.id === selectedId) || pendingDocs[0] || null

  useEffect(() => {
    if (!pendingDocs.length) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !pendingDocs.some(doc => doc.id === selectedId)) {
      setSelectedId(pendingDocs[0]?.id || null)
    }
  }, [pendingDocs, selectedId])

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
      setSelectedId(json.id)
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  async function openDocument(document) {
    await openDocumentWithAuth({ apiFetch, readJsonOrText, document, setError })
  }

  const pending = pendingDocs
  const approved = orderedDocs.filter(doc => doc.status === 'approved')
  const rejected = orderedDocs.filter(doc => doc.status === 'rejected')

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Review Queue</h1>
          <p className="text-muted-foreground text-sm mt-1">Approve, reject, and refine document metadata before documents become searchable.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Pending</div>
            <div className="text-2xl font-bold mt-1">{pending.length}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Approved</div>
            <div className="text-2xl font-bold mt-1">{approved.length}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Rejected</div>
            <div className="text-2xl font-bold mt-1">{rejected.length}</div>
          </Card>
        </div>

        {error && <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
        {status && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">{status}</div>}

        <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Documents</h2>
              <Button variant="outline" size="sm" onClick={async () => { setBusy(true); try { await loadDocuments() } finally { setBusy(false) } }} disabled={busy}>Refresh</Button>
            </div>
            <div className="space-y-2">
              {pendingDocs.length === 0 ? (
                <Card className="p-6 border-dashed border-border/50 text-sm text-muted-foreground">No documents uploaded yet.</Card>
              ) : pendingDocs.map(doc => (
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
            onOpenDocument={openDocument}
          />
        </div>
      </div>
    </div>
  )
}