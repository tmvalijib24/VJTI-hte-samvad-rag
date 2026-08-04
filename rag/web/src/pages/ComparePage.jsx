import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FileText, ArrowRight, Layers, FileSignature, CheckCircle, Info, Sparkles } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Badge } from '../components/ui/badge'

export default function ComparePage({ documents = [], startNewChat, switchAskMode, setSelectedDocIds }) {
  const { apiFetch, readJsonOrText } = useAuth()
  const navigate = useNavigate()

  // Only approved documents
  const approvedDocs = documents.filter(d => d.status === 'approved')

  const [docAId, setDocAId] = useState('')
  const [docBId, setDocBId] = useState('')

  const [isComparing, setIsComparing] = useState(false)
  const [compareResult, setCompareResult] = useState(null)
  const [error, setError] = useState('')

  // Check for superseded_by or amended_by (stubbed for now per v1 plan)
  useEffect(() => {
    if (docAId) {
      // In a future version, call GET /documents/:id/linked to auto-populate docBId
    }
  }, [docAId])

  async function handleCompare() {
    if (!docAId || !docBId) return
    setError('')
    setIsComparing(true)
    setCompareResult(null)
    try {
      const res = await apiFetch('/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIdA: docAId, documentIdB: docBId })
      })
      const { json, text } = await readJsonOrText(res)
      if (!res.ok) throw new Error(json?.detail || text || 'Comparison failed')
      setCompareResult(json)
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setIsComparing(false)
    }
  }

  // LLM Explanation feature
  const [explainingChunkId, setExplainingChunkId] = useState(null)
  const [explanations, setExplanations] = useState({})

  async function explainDiff(pair) {
    const pairId = pair.chunk_id_a || pair.chunk_id_b
    if (explanations[pairId]) return // Already explained
    
    setExplainingChunkId(pairId)
    try {
      const res = await apiFetch('/compare/explain-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentIdA: docAId,
          documentIdB: docBId,
          textA: pair.text_a,
          textB: pair.text_b
        })
      })
      const { json } = await readJsonOrText(res)
      if (res.ok) {
        setExplanations(prev => ({ ...prev, [pairId]: json.explanation }))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setExplainingChunkId(null)
    }
  }

  function handleChatAboutChange() {
    // Navigate to chat with context
    switchAskMode('document')
    setSelectedDocIds([docAId, docBId])
    startNewChat()
    navigate('/chat')
  }

  const copySummary = () => {
    if (!compareResult) return
    const text = `Document Comparison Summary:\n${compareResult.changes_count} fields changed.\n` +
      compareResult.aligned_pairs
        .filter(p => p.summary !== "Unchanged")
        .map(p => `- ${p.summary}`)
        .join("\n")
    navigator.clipboard.writeText(text)
    alert("Summary copied to clipboard!")
  }

  const docA = documents.find(d => d.id === docAId)
  const docB = documents.find(d => d.id === docBId)

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-border/50 bg-background/50 backdrop-blur-xl shrink-0 z-10">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Layers className="w-6 h-6 text-primary" />
            Compare Documents
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Select two approved documents to view differences side-by-side.</p>
        </div>
        
        {compareResult && (
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={copySummary}>
              <FileSignature className="w-4 h-4 mr-2" />
              Copy Summary
            </Button>
            <Button onClick={handleChatAboutChange}>
              <Sparkles className="w-4 h-4 mr-2" />
              Chat about changes
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
          <div className="space-y-2">
            <label className="text-sm font-medium">Document A (Original)</label>
            <select
              value={docAId}
              onChange={e => setDocAId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select a document...</option>
              {approvedDocs.map(d => (
                <option key={d.id} value={d.id} disabled={d.id === docBId}>
                  {d.document_number ? `[${d.document_number}] ` : ''}{d.title || d.source}
                </option>
              ))}
            </select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Document B (Modified)</label>
            <div className="flex gap-4">
              <select
                value={docBId}
                onChange={e => setDocBId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select a document...</option>
                {approvedDocs.map(d => (
                  <option key={d.id} value={d.id} disabled={d.id === docAId}>
                    {d.document_number ? `[${d.document_number}] ` : ''}{d.title || d.source}
                  </option>
                ))}
              </select>
              <Button onClick={handleCompare} disabled={!docAId || !docBId || isComparing}>
                {isComparing ? 'Comparing...' : 'Compare'}
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20">
            {error}
          </div>
        )}

        {/* Results */}
        {compareResult && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 p-3 bg-secondary/30 border border-border/50 rounded-lg">
              <Info className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">
                Found {compareResult.changes_count} modified fields/clauses between the two documents.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Column Headers */}
              <Card className="p-4 bg-background/50 flex flex-col gap-2">
                <Badge className="w-fit">Document A</Badge>
                <h3 className="font-semibold text-lg">{docA?.title || docA?.source}</h3>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Number: {docA?.document_number || 'N/A'}</p>
                  <p>Department: {docA?.department || 'N/A'}</p>
                </div>
              </Card>
              <Card className="p-4 bg-background/50 flex flex-col gap-2">
                <Badge className="w-fit bg-primary/20 text-primary">Document B</Badge>
                <h3 className="font-semibold text-lg">{docB?.title || docB?.source}</h3>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Number: {docB?.document_number || 'N/A'}</p>
                  <p>Department: {docB?.department || 'N/A'}</p>
                </div>
              </Card>
            </div>

            {/* Chunk Pairs */}
            <div className="space-y-4">
              {compareResult.aligned_pairs.map((pair, idx) => {
                const pairId = pair.chunk_id_a || pair.chunk_id_b
                const isChanged = pair.summary !== "Unchanged"
                
                return (
                  <div key={idx} className={`border rounded-lg overflow-hidden ${isChanged ? 'border-primary/30 shadow-sm' : 'border-border/40 opacity-70'}`}>
                    {isChanged && (
                      <div className="bg-secondary/40 px-4 py-2 border-b border-border/50 flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground">{pair.summary}</span>
                        <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => explainDiff(pair)} disabled={explainingChunkId === pairId}>
                          {explainingChunkId === pairId ? 'Explaining...' : 'Explain change'}
                        </Button>
                      </div>
                    )}
                    
                    {explanations[pairId] && (
                      <div className="bg-primary/5 px-4 py-3 border-b border-primary/10 text-sm">
                        <span className="font-semibold text-primary">AI Explanation: </span>
                        {explanations[pairId]}
                      </div>
                    )}

                    <div className="grid grid-cols-2 divide-x divide-border/50">
                      <div className="p-4 bg-background whitespace-pre-wrap text-sm">
                        {pair.text_a === null ? (
                          <span className="text-muted-foreground italic">[Section Added in B]</span>
                        ) : (
                          pair.diff.map((span, i) => (
                            <span key={i} className={
                              span.type === 'delete' ? 'bg-destructive/20 text-destructive line-through rounded px-0.5' :
                              span.type === 'insert' ? 'hidden' : ''
                            }>
                              {span.value}{' '}
                            </span>
                          ))
                        )}
                      </div>
                      <div className="p-4 bg-background whitespace-pre-wrap text-sm">
                        {pair.text_b === null ? (
                          <span className="text-muted-foreground italic">[Section Removed]</span>
                        ) : (
                          pair.diff.map((span, i) => (
                            <span key={i} className={
                              span.type === 'insert' ? 'bg-emerald-500/20 text-emerald-700 font-medium rounded px-0.5' :
                              span.type === 'delete' ? 'hidden' : ''
                            }>
                              {span.value}{' '}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
