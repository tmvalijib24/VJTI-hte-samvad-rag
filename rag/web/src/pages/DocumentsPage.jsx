import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { DocumentManager } from '../components/documents/DocumentManager'

export default function DocumentsPage({
  documents,
  selectedDocIds,
  setSelectedDocIds,
  loadDocuments,
  canManageDocuments = false,
  isBusy,
  setIsBusy,
  error,
  setError,
  status,
  setStatus,
}) {
  const { apiFetch, readJsonOrText } = useAuth()
  const [url, setUrl] = useState('')
  const [files, setFiles] = useState([])

  async function openDocument(doc) {
    if (!doc?.id) return
    if (doc.source?.startsWith('http://') || doc.source?.startsWith('https://')) {
      window.open(doc.source, '_blank', 'noopener,noreferrer')
      return
    }

    try {
      const res = await apiFetch(`/documents/${doc.id}/download`)
      if (!res.ok) {
        const { json, text } = await readJsonOrText(res)
        throw new Error(json?.detail || text || `Failed to open document (HTTP ${res.status}).`)
      }
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      window.open(blobUrl, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
    } catch (e) {
      setError(e.message || String(e))
    }
  }

  async function deleteDocument(documentId) {
    if (!window.confirm('Are you sure you want to delete this document?')) return
    setError('')
    setStatus('')
    setIsBusy(true)
    try {
      const res = await apiFetch(`/documents/${documentId}`, { method: 'DELETE' })
      const { json, text } = await readJsonOrText(res)
      if (!res.ok) throw new Error(json?.detail || text || `Failed to delete document (HTTP ${res.status}).`)
      setStatus('Document deleted successfully.')
      setSelectedDocIds(prev => prev.filter(id => id !== documentId))
      await loadDocuments()
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setIsBusy(false)
    }
  }

  async function ingestUrl() {
    setError('')
    setStatus('')
    if (!url.trim()) { setError('Please enter a URL.'); return }
    setIsBusy(true)
    setStatus('Ingesting website…')
    try {
      const res = await apiFetch('/ingest/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const { json, text } = await readJsonOrText(res)
      if (!res.ok) throw new Error(json?.detail || text || `Failed to ingest URL (HTTP ${res.status}).`)
      setUrl('')
      setStatus('Ingested URL successfully!')
      await loadDocuments()
      if (json.document_id) setSelectedDocIds(prev => Array.from(new Set([...prev, json.document_id])))
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setIsBusy(false)
    }
  }

  async function ingestFile() {
    setError('')
    setStatus('')
    if (files.length === 0) { setError('Please choose one or more files.'); return }
    if (files.length > 5) { setError('You can upload at most 5 files at a time.'); return }
    setIsBusy(true)
    setStatus('Uploading and ingesting files…')
    try {
      const form = new FormData()
      for (const f of files) form.append('files', f)
      const res = await apiFetch('/ingest/file', { method: 'POST', body: form })
      const { json, text } = await readJsonOrText(res)
      if (!res.ok) throw new Error(json?.detail || text || `Failed to ingest file (HTTP ${res.status}).`)
      const results = json.results || []
      setStatus(`Upload accepted for ${results.length} file(s).`)
      setFiles([])
      await loadDocuments()
      const newIds = results.map(r => r.document_id).filter(Boolean)
      setSelectedDocIds(prev => Array.from(new Set([...prev, ...newIds])))
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Full-width DocumentManager */}
      <div className="w-full max-w-none">
        <DocumentManager
          documents={documents}
          selectedDocIds={selectedDocIds}
          setSelectedDocIds={setSelectedDocIds}
          deleteDocument={deleteDocument}
          canManageDocuments={canManageDocuments}
          onDocumentClick={openDocument}
          fullPage
          status={status}
          error={error}
          isBusy={isBusy}
          url={url}
          setUrl={setUrl}
          files={files}
          setFiles={setFiles}
          submitUpload={e => { e?.preventDefault(); files.length > 0 ? ingestFile() : ingestUrl() }}
          fullPage
        />
      </div>
    </div>
  )
}
