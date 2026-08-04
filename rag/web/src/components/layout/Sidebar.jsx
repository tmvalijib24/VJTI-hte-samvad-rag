import React, { useEffect, useRef } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import gsap from 'gsap'
import { Button } from '../ui/button'
import { LogOut, Plus, FileText, MessageSquare, Trash2, Edit2, LayoutDashboard, History, Settings, GitCompare } from 'lucide-react'
import { ScrollArea } from '../ui/scroll-area'
import { useLanguage } from '../../context/LanguageContext'
import { LanguageSelector } from './LanguageSelector'

export function Sidebar({
  userInfo,
  userRole,
  brandLogo,
  chatSessions,
  sessionId,
  onSessionSelect,
  startNewSession,
  clearAuth,
  openRenameDialog,
  openDeleteDialog,
  askMode,
  setAskMode
}) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const prevSessionIdsRef = useRef(new Set())
  const sessionListRef = useRef(null)

  useEffect(() => {
    const currentIds = new Set(chatSessions.map(s => s.id))
    const prevIds = prevSessionIdsRef.current

    if (prevIds.size > 0 && sessionListRef.current) {
      const newIds = [...currentIds].filter(id => !prevIds.has(id))
      if (newIds.length > 0) {
        const container = sessionListRef.current
        newIds.forEach(id => {
          const el = container.querySelector(`[data-session-id="${id}"]`)
          if (el) {
            gsap.fromTo(el,
              { opacity: 0, y: -10 },
              { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }
            )
          }
        })
      } else {
        // Sessions updated (e.g. title changed) — animate title text
        chatSessions.forEach(s => {
          const prev = [...prevIds]
          if (prev.includes(s.id)) {
            const el = sessionListRef.current?.querySelector(`[data-session-id="${s.id}"] .session-title`)
            if (el) {
              gsap.fromTo(el,
                { opacity: 0.5 },
                { opacity: 1, duration: 0.3, ease: 'power2.out' }
              )
            }
          }
        })
      }
    }

    prevSessionIdsRef.current = currentIds
  }, [chatSessions])

  const navItems = [
    { icon: <LayoutDashboard className="w-4 h-4" />, label: t('nav.dashboard'), path: '/dashboard' },
    { icon: <MessageSquare className="w-4 h-4" />, label: t('nav.chat'), path: '/chat' },
    { icon: <FileText className="w-4 h-4" />, label: t('nav.documents'), path: '/documents' },
    { icon: <GitCompare className="w-4 h-4" />, label: t('nav.compare'), path: '/compare' },
    { icon: <History className="w-4 h-4" />, label: t('nav.history'), path: '/history' },
    { icon: <Settings className="w-4 h-4" />, label: t('nav.settings'), path: '/settings' },
  ]

  if (userRole === 'legal_reviewer' || userRole === 'system_admin') {
    navItems.splice(3, 0, { icon: <FileText className="w-4 h-4" />, label: t('nav.reviewQueue'), path: '/reviewer' })
  }
  if (userRole === 'system_admin') {
    navItems.splice(5, 0, { icon: <Settings className="w-4 h-4" />, label: t('nav.adminConsole'), path: '/admin' })
  }

  return (
    <aside className="w-72 shrink-0 flex flex-col h-screen border-r border-border/50 bg-background/60 backdrop-blur-xl z-10 relative">
      {/* Logo header */}
      <div className="p-4 flex items-center justify-between border-b border-border/50">
        <Link to="/" className="flex items-center gap-2.5 overflow-hidden hover:opacity-80 transition-opacity">
          <img src={brandLogo} alt="Logo" className="w-8 h-8 rounded-lg shrink-0 shadow-sm" />
          <div className="min-w-0">
            <h2 className="text-sm font-bold truncate text-foreground">RAGNexus</h2>
            <p className="text-xs text-muted-foreground truncate">{userInfo?.full_name || userInfo?.email || 'Workspace'}</p>
          </div>
        </Link>
        <div className="flex items-center gap-1">
          <LanguageSelector />
          <Button variant="ghost" size="icon" onClick={clearAuth} title={t('nav.logout')} className="shrink-0">
            <LogOut className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </Button>
        </div>
      </div>

      {/* New Chat button */}
      <div className="p-3">
        <Button
          onClick={() => { startNewSession(); navigate('/chat') }}
          className="w-full justify-start rounded-xl shadow-sm hover:shadow transition-all bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('nav.newChat')}
        </Button>
      </div>

      {/* Nav items */}
      <div className="px-3 space-y-0.5">
        {navItems.map(item => {
          const isActive = location.pathname === item.path
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          )
        })}
      </div>

      {/* Mode toggle — only on /chat */}
      {location.pathname === '/chat' && userRole !== 'desk_officer' && (
        <div className="px-3 py-3">
          <div className="bg-secondary/40 rounded-xl p-1 border border-border/50 flex">
            <button
              onClick={() => setAskMode('document')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-medium rounded-lg transition-all ${
                askMode === 'document' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              PDFs
            </button>
            <button
              onClick={() => setAskMode('basic')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-medium rounded-lg transition-all ${
                askMode === 'basic' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Basic
            </button>
          </div>
        </div>
      )}

      {location.pathname === '/chat' && userRole === 'desk_officer' && (
        <div className="px-3 py-3">
          <div className="bg-secondary/40 rounded-xl p-3 border border-border/50 text-xs text-muted-foreground">
            Document mode only for this account.
          </div>
        </div>
      )}

      {/* Recent chats */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Recent Chats
        </div>
        <ScrollArea className="flex-1 px-3">
          <div ref={sessionListRef} className="space-y-0.5 pb-4">
            {chatSessions.map((session) => (
              <div
                key={session.id}
                data-session-id={session.id}
                className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                  session.id === sessionId ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-secondary/50 text-foreground'
                }`}
                onClick={() => { onSessionSelect(session); navigate('/chat') }}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60" />
                  <div className="truncate text-xs session-title">
                    {session.title || 'New Chat'}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); openRenameDialog(session) }}>
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); openDeleteDialog(session) }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
            {chatSessions.length === 0 && (
              <div className="text-center py-8 text-xs text-muted-foreground">
                No recent chats
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </aside>
  )
}
