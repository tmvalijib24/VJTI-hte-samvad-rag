import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/button'
import { Scene } from '../components/canvas/Scene'
import gsap from 'gsap'

export default function RegisterPage() {
  const { persistAuth, API_URL, readJsonOrText } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  
  const cardRef = useRef(null)
  const formRef = useRef(null)

  useEffect(() => {
    // Card slide up and fade in
    gsap.fromTo(cardRef.current,
      { y: 40, opacity: 0 },
      { y: 0, opacity: 1, duration: 1, ease: "power3.out" }
    );
    
    // Stagger form elements
    if (formRef.current) {
      gsap.fromTo(formRef.current.children,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, stagger: 0.1, ease: "power3.out", delay: 0.2 }
      );
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setBusy(true)
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, full_name: name.trim() || undefined }),
      })
      const { json, text } = await readJsonOrText(res)
      if (!res.ok) throw new Error(json?.detail || text || `Registration failed (HTTP ${res.status})`)
      persistAuth(json)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center relative overflow-hidden font-sans"
    >
      {/* Animated Three.js Background */}
      <Scene mode="particles" />
      
      {/* Subtle overlay for legibility */}
      <div 
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{ background: "radial-gradient(circle at center, transparent 30%, rgba(7,15,31,0.7) 100%)" }}
      />

      <div className="relative z-10 w-full max-w-md px-6 my-10">
        {/* Floating Glass Card */}
        <div 
          ref={cardRef}
          className="w-full rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-md"
          style={{
            backgroundColor: "rgba(15,23,42,0.72)",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 0 40px rgba(59, 130, 246, 0.15), inset 0 0 20px rgba(255, 255, 255, 0.02)"
          }}
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: "#FFFFFF" }}>
              Create your account
            </h1>
            <p className="text-sm" style={{ color: "#CBD5E1" }}>
              Start using the AI workspace in seconds.
            </p>
          </div>

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#FFFFFF" }} htmlFor="reg-name">
                Full name <span style={{ color: "#94A3B8", fontWeight: "normal" }}>(optional)</span>
              </label>
              <input
                id="reg-name"
                type="text"
                autoComplete="name"
                className="w-full h-12 rounded-xl px-4 text-sm transition-all focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: "#0B1428",
                  borderColor: "rgba(255,255,255,0.08)",
                  borderWidth: "1px",
                  color: "#FFFFFF",
                  '--tw-ring-color': "rgba(59, 130, 246, 0.5)"
                }}
                placeholder="Your name"
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={busy}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#FFFFFF" }} htmlFor="reg-email">
                Email address
              </label>
              <input
                id="reg-email"
                type="email"
                autoComplete="email"
                required
                className="w-full h-12 rounded-xl px-4 text-sm transition-all focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: "#0B1428",
                  borderColor: "rgba(255,255,255,0.08)",
                  borderWidth: "1px",
                  color: "#FFFFFF",
                  '--tw-ring-color': "rgba(59, 130, 246, 0.5)"
                }}
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={busy}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#FFFFFF" }} htmlFor="reg-password">
                Password <span style={{ color: "#94A3B8", fontWeight: "normal" }}>(min 8 chars)</span>
              </label>
              <input
                id="reg-password"
                type="password"
                autoComplete="new-password"
                required
                className="w-full h-12 rounded-xl px-4 text-sm transition-all focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: "#0B1428",
                  borderColor: "rgba(255,255,255,0.08)",
                  borderWidth: "1px",
                  color: "#FFFFFF",
                  '--tw-ring-color': "rgba(59, 130, 246, 0.5)"
                }}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={busy}
              />
            </div>

            {error && (
              <div 
                className="text-sm rounded-xl px-4 py-3"
                style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#FCA5A5", border: "1px solid rgba(239, 68, 68, 0.2)" }}
              >
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 font-semibold rounded-xl transition-all duration-300 transform hover:-translate-y-0.5"
              style={{
                backgroundColor: "#3B82F6",
                color: "#FFFFFF",
                boxShadow: "0 4px 14px 0 rgba(59, 130, 246, 0.39)"
              }}
              disabled={busy}
            >
              {busy ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Creating account…
                </span>
              ) : 'Create account'}
            </Button>

            <div className="mt-8 text-center text-sm" style={{ color: "#94A3B8" }}>
              Already have an account?{' '}
              <Link 
                to="/login" 
                className="font-medium transition-colors hover:underline"
                style={{ color: "#60A5FA" }}
              >
                Sign in
              </Link>
            </div>
            
            <div className="text-center pt-2">
              <Link 
                to="/" 
                className="text-sm transition-colors hover:underline"
                style={{ color: "#94A3B8" }}
              >
                ← Back to home
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
