import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { MessageSquare, Upload, History, FileText, Plus, Bot, Clock, Trash2 } from 'lucide-react'
import { Button } from '../components/ui/button'

export default function DashboardPage({
  chatSessions,
  documents,
  openSession,
  askMode,
  deleteSession,
}) {
  const navigate = useNavigate()
  const { userInfo, clearAuth } = useAuth()

  const firstName = userInfo?.full_name?.split(' ')[0] || userInfo?.email?.split('@')[0] || 'there'
  const recentSessions = chatSessions.slice(0, 5)

  function formatDate(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const quickActions = [
    {
      icon: <Plus className="w-5 h-5" />,
      label: 'New Chat',
      desc: 'Start a fresh conversation',
      color: 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20',
      action: () => navigate('/chat'),
    },
    {
      icon: <Upload className="w-5 h-5" />,
      label: 'Upload Documents',
      desc: 'Add PDFs, text, or URLs',
      color: 'bg-secondary/60 text-secondary-foreground border-border hover:bg-secondary',
      action: () => navigate('/documents'),
    },
    {
      icon: <History className="w-5 h-5" />,
      label: 'Chat History',
      desc: 'Browse past conversations',
      color: 'bg-secondary/60 text-secondary-foreground border-border hover:bg-secondary',
      action: () => navigate('/history'),
    },
  ]

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-10">
      <div className="max-w-4xl mx-auto space-y-10">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Good to see you, <span className="text-primary">{firstName}</span> 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            You have {documents.length} document{documents.length !== 1 ? 's' : ''} and {chatSessions.length} conversation{chatSessions.length !== 1 ? 's' : ''} in your workspace.
          </p>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {quickActions.map(a => (
              <button
                key={a.label}
                onClick={a.action}
                className={`flex items-center gap-4 p-4 rounded-xl border text-left transition-all duration-200 ${a.color}`}
              >
                <div className="shrink-0">{a.icon}</div>
                <div>
                  <div className="font-semibold text-sm">{a.label}</div>
                  <div className="text-xs opacity-70 mt-0.5">{a.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Documents', value: documents.length, icon: <FileText className="w-4 h-4" /> },
            { label: 'Conversations', value: chatSessions.length, icon: <MessageSquare className="w-4 h-4" /> },
            { label: 'Doc Chats', value: chatSessions.filter(s => s.mode === 'document').length, icon: <Bot className="w-4 h-4" /> },
            { label: 'Basic Chats', value: chatSessions.filter(s => s.mode === 'basic').length, icon: <MessageSquare className="w-4 h-4" /> },
          ].map(stat => (
            <div key={stat.label} className="bg-card border border-border/50 rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                {stat.icon}
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Chats */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Conversations</h2>
            <button onClick={() => navigate('/history')} className="text-xs text-primary hover:underline">
              View all
            </button>
          </div>
          {recentSessions.length === 0 ? (
            <div className="bg-secondary/20 border border-dashed border-border/50 rounded-xl p-8 text-center text-muted-foreground text-sm">
              No conversations yet. <button onClick={() => navigate('/chat')} className="text-primary hover:underline">Start your first chat →</button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentSessions.map(s => (
                <div key={s.id} className="relative group w-full flex items-center p-3.5 bg-card border border-border/40 rounded-xl hover:border-primary/30 hover:bg-primary/5 transition-all">
                  <button
                    onClick={() => { openSession(s); navigate('/chat') }}
                    className="flex-1 min-w-0 flex items-center gap-3 text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      {s.mode === 'document' ? <FileText className="w-4 h-4 text-primary" /> : <MessageSquare className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-foreground truncate">
                        {s.title || (s.mode === 'document' ? 'Document chat' : 'Basic chat')}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        {formatDate(s.updated_at)}
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 shrink-0 pl-2">
                    <div className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                      {s.mode}
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); deleteSession(s); }}
                      className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete chat"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Documents */}
        {documents.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Knowledge Base</h2>
              <button onClick={() => navigate('/documents')} className="text-xs text-primary hover:underline">
                Manage
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {documents.slice(0, 4).map(doc => (
                <div key={doc.id} className="flex items-center gap-3 p-3 bg-card border border-border/40 rounded-xl">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{doc.title || doc.source}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{doc.created_at ? new Date(doc.created_at).toLocaleDateString() : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
