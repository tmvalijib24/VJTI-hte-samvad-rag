import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Sidebar } from '../components/layout/Sidebar'
import brandLogo from '../assets/hero.png'

export function AuthLayout({
  chatSessions,
  sessionId,
  openSession,
  startNewChat,
  renameSession,
  deleteSession,
  askMode,
  switchAskMode,
}) {
  const { userInfo, userRole, clearAuth } = useAuth()
  const navigate = useNavigate()

  function handleClearAuth() {
    clearAuth()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans text-foreground">
      <Sidebar
        userInfo={userInfo}
        userRole={userRole}
        brandLogo={brandLogo}
        chatSessions={chatSessions}
        sessionId={sessionId}
        onSessionSelect={openSession}
        startNewSession={startNewChat}
        clearAuth={handleClearAuth}
        openRenameDialog={renameSession}
        openDeleteDialog={deleteSession}
        askMode={askMode}
        setAskMode={switchAskMode}
      />
      <div className="flex-1 flex flex-col relative h-full overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}
