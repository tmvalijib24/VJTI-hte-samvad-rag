import { Outlet, useLocation } from 'react-router-dom'
import { LanguageSelector } from '../components/layout/LanguageSelector'

/** Minimal wrapper for public-facing pages (landing, login, register). */
export function PublicLayout() {
  const location = useLocation()
  
  return (
    <div className="min-h-screen bg-background text-foreground relative">
      {location.pathname !== '/' && (
        <div className="absolute top-4 right-4 z-50">
          <LanguageSelector />
        </div>
      )}
      <Outlet />
    </div>
  )
}
