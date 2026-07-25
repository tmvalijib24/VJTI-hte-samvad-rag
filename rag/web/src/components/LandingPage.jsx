import React from 'react'

function LandingPage({
  brandLogo,
  authMode,
  setAuthMode,
  submitAuth,
  authName,
  setAuthName,
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  authBusy,
  authError,
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f5f7fb] text-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(59,130,246,0.22),transparent_38%),radial-gradient(circle_at_88%_18%,rgba(168,85,247,0.2),transparent_34%),radial-gradient(circle_at_52%_92%,rgba(20,184,166,0.18),transparent_32%)]" />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-[480px] w-[860px] -translate-x-1/2 rounded-full bg-white/70 blur-3xl" />

      <nav className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 pb-4 pt-7 lg:px-10">
        <div className="flex items-center gap-3">
          <img src={brandLogo} alt="Logo" className="h-9 w-9 rounded-xl ring-1 ring-slate-300/60" />
          <span className="text-[1.05rem] font-semibold tracking-tight text-slate-900">
            RAGNexus <span className="font-normal text-slate-500">Cloud</span>
          </span>
        </div>
        <div className="hidden items-center gap-8 text-sm text-slate-600 md:flex">
          <a href="#features" className="transition hover:text-slate-900">Features</a>
          <a href="#benefits" className="transition hover:text-slate-900">Benefits</a>
          <a href="#security" className="transition hover:text-slate-900">Security</a>
        </div>
      </nav>

      <main className="relative z-10 mx-auto grid w-full max-w-7xl gap-10 px-6 pb-12 pt-6 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16 lg:px-10 lg:pb-20">
        <section className="space-y-8 self-center">
          

          <div className="space-y-5">
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-slate-900 sm:text-5xl lg:text-6xl">
              Build AI answers over your knowledge base with enterprise polish.
            </h1>
            <p className="max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              RAGNexus unifies ingestion, hybrid retrieval, and grounded response generation in one clean workspace.
              Bring your PDFs, URLs, CSVs, and docs, then deliver fast answers your users can verify.
            </p>
          </div>

          <div id="features" className="grid gap-3 sm:grid-cols-2">
            {[
              'Multi-tenant isolation by default',
              'Hybrid search with reranking',
              'Source-cited responses in chat',
              'Secure auth + API rate limits',
            ].map((item) => (
              <div
                key={item}
                className="group rounded-2xl border border-slate-300/70 bg-white/65 px-4 py-3 text-sm text-slate-700 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.45)] backdrop-blur transition hover:-translate-y-0.5 hover:border-slate-400"
              >
                <span className="mr-2 text-emerald-500">●</span>
                {item}
              </div>
            ))}
          </div>

          <div id="benefits" className="grid gap-4 pt-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-300/70 bg-white/70 p-4 backdrop-blur">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Latency</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">-42%</div>
              <p className="mt-1 text-sm text-slate-600">Faster first answer with optimized retrieval.</p>
            </div>
            <div className="rounded-2xl border border-slate-300/70 bg-white/70 p-4 backdrop-blur">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trust</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">98%</div>
              <p className="mt-1 text-sm text-slate-600">Answers include chunk-level evidence by design.</p>
            </div>
            <div id="security" className="rounded-2xl border border-slate-300/70 bg-white/70 p-4 backdrop-blur">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Security</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">SOC-ready</div>
              <p className="mt-1 text-sm text-slate-600">JWT, role-ready model, tenant-aware storage paths.</p>
            </div>
          </div>
        </section>

        <section className="relative">
          <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-sky-200/50 via-violet-200/40 to-cyan-100/40 blur-2xl" />

          <div className="relative rounded-[1.75rem] border border-slate-300/70 bg-white/75 p-6 shadow-[0_24px_80px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-8">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                  {authMode === 'login' ? 'Welcome back' : 'Create your workspace'}
                </h2>
                <p className="mt-1 text-sm text-slate-600">Secure access to your private RAG stack.</p>
              </div>
              
            </div>

            <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  authMode === 'login'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                onClick={() => setAuthMode('login')}
              >
                Sign in
              </button>
              <button
                type="button"
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  authMode === 'register'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                onClick={() => setAuthMode('register')}
              >
                Register
              </button>
            </div>

            <form className="space-y-4" onSubmit={submitAuth}>
              {authMode === 'register' && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Full name</label>
                  <input
                    type="text"
                    placeholder="Alex Rivera"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    disabled={authBusy}
                    className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-800 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Work email</label>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  disabled={authBusy}
                  required
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-800 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Password</label>
                <input
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  disabled={authBusy}
                  required
                  minLength={8}
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-800 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                />
              </div>

              {authError ? (
                <div className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {authError}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={authBusy}
                className="group relative flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-sm font-semibold text-white shadow-[0_14px_35px_-16px_rgba(15,23,42,0.9)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {authBusy ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Processing...
                  </span>
                ) : authMode === 'login' ? (
                  'Access Dashboard'
                ) : (
                  'Create Account'
                )}
              </button>
            </form>

            

            <div className="mt-4 text-center text-xs text-slate-500">
              By continuing, you agree to secure data processing with tenant isolation.
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default LandingPage
