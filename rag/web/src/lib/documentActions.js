export async function openDocumentWithAuth({ apiFetch, readJsonOrText, document, setError }) {
  if (!document?.id) return

  if (document.source?.startsWith('http://') || document.source?.startsWith('https://')) {
    window.open(document.source, '_blank', 'noopener,noreferrer')
    return
  }

  try {
    const res = await apiFetch(`/documents/${document.id}/download`)
    if (!res.ok) {
      const { json, text } = await readJsonOrText(res)
      throw new Error(json?.detail || text || `Failed to open document (HTTP ${res.status}).`)
    }

    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    window.open(blobUrl, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
  } catch (error) {
    setError(error.message || String(error))
  }
}