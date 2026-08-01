import { Outlet } from 'react-router-dom'

/** Minimal wrapper for public-facing pages (landing, login, register). */
export function PublicLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Outlet />
    </div>
  )
}
