import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LogOut, User, Mail, Shield } from 'lucide-react'
import { Button } from '../components/ui/button'

export default function SettingsPage() {
  const { userInfo, userRole, clearAuth } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    clearAuth()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-10">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your account preferences</p>
        </div>

        {/* Profile card */}
        <div className="bg-card border border-border/50 rounded-2xl p-6 space-y-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Profile</h2>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold shrink-0">
              {(userInfo?.full_name || userInfo?.email || 'U')[0].toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-foreground">{userInfo?.full_name || 'No name set'}</div>
              <div className="text-sm text-muted-foreground">{userInfo?.email}</div>
            </div>
          </div>
          <div className="grid gap-4">
            <div className="flex items-center gap-3 text-sm">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground w-24">Full name</span>
              <span className="text-foreground">{userInfo?.full_name || '—'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground w-24">Email</span>
              <span className="text-foreground">{userInfo?.email || '—'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground w-24">Role</span>
              <span className="text-foreground">{userRole}</span>
            </div>
          </div>
        </div>

        {/* Danger zone */}
        <div className="bg-card border border-destructive/20 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-destructive uppercase tracking-wider">Session</h2>
          <p className="text-sm text-muted-foreground">Signing out will clear your local session. Your data remains in your account.</p>
          <Button variant="destructive" onClick={handleLogout} className="flex items-center gap-2">
            <LogOut className="w-4 h-4" />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}
