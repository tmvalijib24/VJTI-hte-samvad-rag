import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ChatArea } from '../components/chat/ChatArea'
import { ChatInput } from '../components/chat/ChatInput'
import { DocumentManager } from '../components/documents/DocumentManager'

export default function ChatPage({
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
  canManageDocuments = false,
  canUseBasicChat = false,
}) {
  const { apiFetch, readJsonOrText } = useAuth()
  const navigate = useNavigate()
  const [question, setQuestion] = useState('')
  const [url, setUrl] = useState('')
  const [files, setFiles] = useState([])
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [voiceError, setVoiceError] = useState('')

  const listRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])

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

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages.length, isBusy])

  const canAsk = useMemo(() => {
    if (isBusy || question.trim().length === 0) return false
    if (askMode === 'document') return selectedDocIds.length > 0
    return true
  }, [askMode, selectedDocIds, question, isBusy])

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
      const isProcessing = json.status === 'processing' || results.some(r => r?.status === 'processing')
      setStatus(isProcessing ? `Upload accepted. Ingestion started for ${results.length} file(s).` : `Ingested ${results.length} file(s) successfully.`)
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

  async function deleteDocument(documentId) {
    if (!window.confirm('Are you sure you want to delete this document? This will remove all its chunks and chat citations.')) return
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

  async function startRecording() {
    setVoiceError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError('Your browser does not support microphone access.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm',
      })
      audioChunksRef.current = []
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        audioChunksRef.current = []
        if (audioBlob.size < 100) { setVoiceError('Recording was too short or empty.'); return }
        await transcribeAudio(audioBlob)
      }
      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setVoiceError('Microphone permission was denied.')
      } else {
        setVoiceError(`Could not access microphone: ${err.message || String(err)}`)
      }
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }

  async function transcribeAudio(audioBlob) {
    setIsTranscribing(true)
    setVoiceError('')
    try {
      const form = new FormData()
      form.append('file', audioBlob, 'recording.webm')
      const res = await apiFetch('/transcribe', { method: 'POST', body: form })
      const { json, text } = await readJsonOrText(res)
      if (!res.ok) throw new Error(json?.detail || text || `Transcription failed (HTTP ${res.status}).`)
      const transcribedText = (json?.text || '').trim()
      if (!transcribedText) { setVoiceError('No speech detected. Please try again.'); return }
      setQuestion(prev => { const ex = prev.trim(); return ex ? `${ex} ${transcribedText}` : transcribedText })
    } catch (e) {
      setVoiceError(e.message || String(e))
    } finally {
      setIsTranscribing(false)
    }
  }

  async function sendQuestion() {
    const q = question.trim()
    if (askMode === 'basic' && !canUseBasicChat) {
      setError('Basic chat is available only for reviewer/admin accounts.')
      return
    }
    if (askMode === 'document' && selectedDocIds.length === 0) { setError('Please select at least one document.'); return }
    if (!q) return
    setError('')
    setStatus('')
    setQuestion('')
    const userMsg = { id: crypto.randomUUID(), role: 'user', content: q }
    setMessages(m => [...m, userMsg])
    setIsBusy(true)
    try {
      const endpoint = askMode === 'document' ? '/ask' : '/chat/basic'
      const payload = askMode === 'document'
        ? { document_ids: selectedDocIds, question: q, top_k: 10, session_id: sessionId }
        : { message: q, session_id: sessionId }
      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const { json, text } = await readJsonOrText(res)
      if (!res.ok) throw new Error(json?.detail || text || `Failed to answer (HTTP ${res.status}).`)
      const assistantMsg = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: json.answer,
        sources: Array.isArray(json.sources) ? json.sources : [],
      }
      if (json.session_id) setSessionId(json.session_id)
      setMessages(m => [...m, assistantMsg])
      await loadSessionList()
    } catch (e) {
      setMessages(m => [...m, { id: crypto.randomUUID(), role: 'assistant', content: `Error: ${e.message || String(e)}`, isError: true }])
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      <div className="flex flex-col flex-1 relative">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-primary/5 via-background to-background -z-10" />

        <ChatArea
          messages={messages}
          isBusy={isBusy}
          defaultAssistantMessage={defaultAssistantMessage}
          askMode={askMode}
          selectedDocIds={selectedDocIds}
          listRef={listRef}
        />

        {voiceError && (
          <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 bg-destructive/90 text-white text-xs rounded-lg px-4 py-2 shadow-lg">
            {voiceError}
          </div>
        )}

        <ChatInput
          question={question}
          setQuestion={setQuestion}
          canAsk={canAsk}
          submitAsk={e => { e?.preventDefault(); sendQuestion() }}
          isBusy={isBusy}
          stopAsk={() => {}}
          isRecording={isRecording}
          isTranscribing={isTranscribing}
          toggleRecording={isRecording ? stopRecording : startRecording}
        />
      </div>

      <DocumentManager
        documents={documents}
        selectedDocIds={selectedDocIds}
        setSelectedDocIds={setSelectedDocIds}
        deleteDocument={deleteDocument}
        canManageDocuments={canManageDocuments}
        onDocumentClick={openDocument}
        status={status}
        error={error}
        isBusy={isBusy}
        url={url}
        setUrl={setUrl}
        files={files}
        setFiles={setFiles}
        submitUpload={e => { e?.preventDefault(); files.length > 0 ? ingestFile() : ingestUrl() }}
      />

      
    </div>
  )
}

