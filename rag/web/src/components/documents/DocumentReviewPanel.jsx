import { useEffect, useState } from 'react'
import { ExternalLink, Save, CheckCircle, XCircle, Trash2 } from 'lucide-react'
import { Card } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'

export function DocumentReviewPanel({
  document,
  busy,
  onSaveMetadata,
  onReview,
  onDelete,
  onOpenDocument,
}) {
  const [form, setForm] = useState({
    title: '',
    department: '',
    document_number: '',
    document_date: '',
    category: '',
    language: '',
  })
  const [reviewNotes, setReviewNotes] = useState('')

  useEffect(() => {
    setForm({
      title: document?.title || '',
      department: document?.department || '',
      document_number: document?.document_number || '',
      document_date: document?.document_date ? String(document.document_date).slice(0, 10) : '',
      category: document?.category || '',
      language: document?.language || '',
    })
    setReviewNotes(document?.review_notes || '')
  }, [document])

  if (!document) {
    return (
      <Card className="p-6 border-dashed border-border/50 bg-background/60">
        <div className="text-sm text-muted-foreground">Select a document to review its metadata and approval state.</div>
      </Card>
    )
  }

  return (
    <Card className="p-5 space-y-4 bg-card border-border/50">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-lg font-semibold text-foreground truncate">{document.title || document.source}</div>
          <div className="text-xs text-muted-foreground mt-1 truncate">{document.source}</div>
        </div>
        <Badge variant={document.status === 'approved' ? 'secondary' : document.status === 'rejected' ? 'destructive' : 'outline'}>
          {document.status?.replace('_', ' ') || 'unknown'}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Title</label>
          <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} disabled={busy} className="mt-1" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Department</label>
          <Input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} disabled={busy} className="mt-1" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Document Number</label>
          <Input value={form.document_number} onChange={e => setForm(f => ({ ...f, document_number: e.target.value }))} disabled={busy} className="mt-1" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Document Date</label>
          <Input type="date" value={form.document_date} onChange={e => setForm(f => ({ ...f, document_date: e.target.value }))} disabled={busy} className="mt-1" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Category</label>
          <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} disabled={busy} className="mt-1" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Language</label>
          <Input value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))} disabled={busy} className="mt-1" />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Review Notes</label>
        <textarea
          value={reviewNotes}
          onChange={e => setReviewNotes(e.target.value)}
          disabled={busy}
          rows={3}
          className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Add internal review notes"
        />
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={busy}
          onClick={() => onOpenDocument?.(document)}
        >
          <ExternalLink className="w-4 h-4" />
          Open
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="gap-2"
          disabled={busy}
          onClick={() => onSaveMetadata?.(document, form)}
        >
          <Save className="w-4 h-4" />
          Save Metadata
        </Button>
        <Button
          type="button"
          className="gap-2"
          disabled={busy}
          onClick={() => onReview?.(document, 'approved', reviewNotes)}
        >
          <CheckCircle className="w-4 h-4" />
          Approve
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="gap-2"
          disabled={busy}
          onClick={() => onReview?.(document, 'rejected', reviewNotes)}
        >
          <XCircle className="w-4 h-4" />
          Reject
        </Button>
        {onDelete ? (
          <Button
            type="button"
            variant="outline"
            className="gap-2 text-destructive hover:text-destructive"
            disabled={busy}
            onClick={() => onDelete?.(document)}
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>
        ) : null}
      </div>
    </Card>
  )
}