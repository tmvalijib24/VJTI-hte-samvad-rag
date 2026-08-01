import { useNavigate } from 'react-router-dom'
import { MessageSquare, FileText, Clock, Trash2 } from 'lucide-react'
import { Button } from '../components/ui/button'

export default function HistoryPage({ chatSessions, openSession }) {
  const navigate = useNavigate()

  function formatDate(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  // Group by date
  const grouped = chatSessions.reduce((acc, s) => {
    const key = s.updated_at ? new Date(s.updated_at).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }) : 'Unknown date'
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-10">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Chat History</h1>
          <p className="text-muted-foreground text-sm mt-1">{chatSessions.length} conversation{chatSessions.length !== 1 ? 's' : ''} total</p>
        </div>

        {chatSessions.length === 0 ? (
          <div className="bg-secondary/20 border border-dashed border-border/50 rounded-xl p-12 text-center">
            <MessageSquare className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No conversations yet.</p>
            <button onClick={() => navigate('/chat')} className="mt-3 text-sm text-primary hover:underline">Start your first chat →</button>
          </div>
        ) : (
          Object.entries(grouped).map(([date, sessions]) => (
            <div key={date}>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                {date}
              </div>
              <div className="space-y-2">
                {sessions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { openSession(s); navigate('/chat') }}
                    className="w-full flex items-center gap-4 p-4 bg-card border border-border/40 rounded-xl text-left hover:border-primary/30 hover:bg-primary/5 transition-all group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      {s.mode === 'document'
                        ? <FileText className="w-4 h-4 text-primary" />
                        : <MessageSquare className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-foreground truncate">
                        {s.title || (s.mode === 'document' ? 'Document chat' : 'Basic chat')}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{formatDate(s.updated_at)}</div>
                    </div>
                    <div className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full shrink-0">
                      {s.mode}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
