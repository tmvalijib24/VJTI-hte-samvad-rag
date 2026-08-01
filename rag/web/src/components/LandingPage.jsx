import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Scene } from "./canvas/Scene";
import { Card, CardContent } from "./ui/card";
import {
  Brain,
  Sparkles,
  Shield,
  Zap,
  Search,
  Mic,
  FileText,
  Globe,
  ArrowRight,
} from "lucide-react";
import brandLogo from "../assets/hero.png";
import { scrollState } from "./canvas/scrollState";

import { useAuth } from "../context/AuthContext";

gsap.registerPlugin(ScrollTrigger);

export default function LandingPage() {
  const { isAuthed } = useAuth();
  const containerRef = useRef(null);
  const heroTextRef = useRef(null);
  const featuresRef = useRef(null);

  useEffect(() => {
    if (!heroTextRef.current || !featuresRef.current || !containerRef.current)
      return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        heroTextRef.current.children,
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 1, stagger: 0.2, ease: "power3.out" },
      );
      gsap.fromTo(
        ".feature-card",
        { y: 40, opacity: 0 },
        {
          scrollTrigger: { trigger: featuresRef.current, start: "top 80%" },
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.15,
          ease: "power2.out",
        },
      );

      // ── Water droplet scroll progress (drives WaterScene) ─────────────────
      scrollState.progress = 0;
      scrollState.splashFired = false;
      scrollState.splashTime = -1;

      ScrollTrigger.create({
        trigger: containerRef.current,
        start: "top top",
        end: "bottom bottom",
        scrub: 1.8,
        onUpdate: (self) => {
          scrollState.progress = self.progress;
        },
        onLeave: () => {
          scrollState.progress = 1;
        },
        onLeaveBack: () => {
          scrollState.progress = 0;
        },
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    /* Force dark background so 3D canvas + white text always has contrast */
    <div
      ref={containerRef}
      className="relative min-h-screen text-white selection:bg-blue-500 selection:text-white"
    >
      <Scene mode="hero" />

      {/* Dark overlay to improve text legibility over 3D scene */}
      <div
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 50%, rgba(6,14,30,0.15) 100%)",
        }}
      />

      {/* ── Sticky Navbar ────────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3"
        style={{
          background: "rgba(6,14,30,0.75)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <Link
          to="/"
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <img
            src={brandLogo}
            alt="Logo"
            className="h-8 w-8 rounded-lg shadow-sm"
          />
          <span className="text-base font-bold tracking-tight text-white">
            RAGNexus
          </span>
        </Link>
        <div className="hidden items-center gap-6 text-sm font-medium md:flex">
          <a
            href="#features"
            className="text-blue-200/80 hover:text-white transition-colors"
          >
            Features
          </a>
          <a
            href="#capabilities"
            className="text-blue-200/80 hover:text-white transition-colors"
          >
            Technology
          </a>
          <a
            href="#security"
            className="text-blue-200/80 hover:text-white transition-colors"
          >
            Security
          </a>
        </div>
        <div className="flex items-center gap-2">
          {isAuthed ? (
            <Link to="/dashboard">
              <button className="px-4 py-1.5 rounded-full text-sm font-semibold bg-blue-500 text-white hover:bg-blue-400 shadow-lg shadow-blue-900/40 transition-all">
                Go to Dashboard
              </button>
            </Link>
          ) : (
            <>
              <Link to="/login">
                <button className="px-4 py-1.5 rounded-full text-sm font-medium text-blue-100 hover:text-white hover:bg-white/10 transition-all">
                  Sign In
                </button>
              </Link>
              <Link to="/register">
                <button className="px-4 py-1.5 rounded-full text-sm font-semibold bg-blue-500 text-white hover:bg-blue-400 shadow-lg shadow-blue-900/40 transition-all">
                  Get Started
                </button>
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 pt-20 text-center">
        <div ref={heroTextRef} className="max-w-4xl space-y-6">
          <div className="inline-flex items-center rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-sm font-medium text-blue-300">
            <Sparkles className="mr-2 h-3.5 w-3.5 text-blue-400" />
            Retrieval-Augmented Generation Platform
          </div>

          <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl text-white leading-tight drop-shadow-md">
            Intelligence grounded in{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-cyan-300">
              your knowledge
            </span>
            .
          </h1>

          <p className="mx-auto max-w-2xl text-lg sm:text-xl leading-relaxed text-white drop-shadow-md">
            A premium AI workspace that unifies document ingestion, hybrid
            semantic search, and grounded answers with verifiable citations —
            built for accuracy you can trust.
          </p>

          <div className="flex items-center justify-center gap-4 pt-4 flex-wrap">
            <Link to="/register">
              <button className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-base font-semibold bg-blue-500 text-white hover:bg-blue-400 shadow-xl shadow-blue-900/50 hover:-translate-y-0.5 transition-all">
                Start Building Free
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <a href="#features">
              <button className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-base font-semibold text-white border border-white/20 bg-white/5 hover:bg-white/10 hover:-translate-y-0.5 transition-all">
                See Features
              </button>
            </a>
          </div>
        </div>
      </main>

      {/* ── Features Grid ────────────────────────────────────────────────── */}
      <section
        id="features"
        ref={featuresRef}
        className="relative z-10 py-32 px-6 lg:px-8 max-w-7xl mx-auto"
      >
        <div className="mb-16 text-center">
          <h2 className="text-4xl font-bold tracking-tight sm:text-4xl text-white drop-shadow-lg">
            Everything you need
          </h2>
          <p className="mt-4 text-blue-600/80 text-lg drop-shadow-md">
            Built for performance, accuracy, and trust.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: <Zap className="h-6 w-6 text-blue-300" />,
              title: "Ultra-Low Latency",
              desc: "Optimized hybrid retrieval pipeline with BM25 + vector search ensuring lightning-fast, accurate answers.",
            },
            {
              icon: <Search className="h-6 w-6 text-blue-300" />,
              title: "Source Citations",
              desc: "Every response includes verifiable document chunk references with page numbers and relevance scores.",
            },
            {
              icon: <Shield className="h-6 w-6 text-blue-300" />,
              title: "Enterprise Security",
              desc: "Multi-tenant isolation, JWT authentication, rate limiting, and strict per-user access controls.",
            },
            {
              icon: <FileText className="h-6 w-6 text-blue-300" />,
              title: "OCR Support",
              desc: "Automatically extract text from scanned PDFs and images using advanced OCR technology.",
            },
            {
              icon: <Mic className="h-6 w-6 text-blue-300" />,
              title: "Voice Input",
              desc: "Speak your questions naturally with built-in Whisper-powered voice transcription.",
            },
            {
              icon: <Globe className="h-6 w-6 text-blue-300" />,
              title: "URL Ingestion",
              desc: "Ingest content from any public webpage — paste a URL and ask questions instantly.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="feature-card rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-1"
              style={{
                background: "rgba(255,255,255,0.04)",
                borderColor: "rgba(255,255,255,0.1)",
                backdropFilter: "blur(12px)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(99,179,237,0.35)";
                e.currentTarget.style.background = "rgba(99,179,237,0.07)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              }}
            >
              <div className="w-11 h-11 rounded-xl bg-blue-500/15 flex items-center justify-center mb-4 border border-blue-400/20 drop-shadow-md">
                {f.icon}
              </div>
              <h3 className="text-base font-semibold mb-2 text-white drop-shadow-lg">
                {f.title}
              </h3>
              <p className="text-sm text-blue-600/70 drop-shadow-md leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Technology section ───────────────────────────────────────────── */}
      <section
        id="capabilities"
        className="relative z-10 py-24 px-6"
        style={{
          background: "rgba(255,255,255,0.03)",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-3xl font-bold tracking-tight text-white">
            Powered by cutting-edge AI
          </h2>
          <p className="text-blue-200 drop-shadow-md text-lg">
            A complete RAG pipeline with hybrid retrieval, reranking, and
            generation.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            {[
              "Hybrid Search",
              "HyDE Expansion",
              "Cross-Encoder Reranking",
              "Groq LLM",
              "Qdrant Vector DB",
              "Whisper ASR",
              "Multilingual OCR",
              "FastAPI Backend",
            ].map((tag) => (
              <span
                key={tag}
                className="px-3 py-1.5 rounded-full text-xs font-semibold text-blue-200 border"
                style={{
                  background: "rgba(19, 85, 190, 1)",
                  borderColor: "rgba(3, 146, 248, 1)",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security section ─────────────────────────────────────────────── */}
      <section
        id="security"
        className="relative z-10 py-24 px-6 max-w-4xl mx-auto text-center"
      >
        <Shield className="h-12 w-12 text-blue-400 mx-auto mb-4" />
        <h2 className="text-3xl font-bold tracking-tight text-white mb-4">
          Built for security
        </h2>
        <p className="text-blue-200/70 mb-10">
          Your documents never mix. Every user operates in strict isolation.
        </p>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            {
              title: "Multi-Tenant Isolation",
              desc: "Each user's data is fully separated in both the vector store and database.",
            },
            {
              title: "JWT Authentication",
              desc: "Short-lived access tokens with refresh rotation and secure storage.",
            },
            {
              title: "Rate Limiting",
              desc: "Built-in rate limits protect against abuse and ensure fair usage.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="p-5 rounded-xl text-left"
              style={{
                background: "rgba(255, 255, 255, 0.19)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <h3 className="font-semibold text-sm text-white drop-shadow-lg mb-1.5">
                {item.title}
              </h3>
              <p className="text-xs text-blue-600/60 drop-shadow-md leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────────────────────── */}
      <section className="relative z-10 py-24 px-6">
        <div
          className="max-w-2xl mx-auto text-center rounded-3xl p-12"
          style={{
            background: "rgba(59,130,246,0.08)",
            border: "1px solid rgba(99,179,237,0.2)",
            backdropFilter: "blur(12px)",
          }}
        >
          <Brain className="h-10 w-10 text-blue-400 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to get started?
          </h2>
          <p className="text-blue-200/70 mb-8">
            Create your free workspace in seconds. No credit card required.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link to="/register">
              <button className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-base font-semibold bg-blue-500 text-white hover:bg-blue-400 shadow-xl shadow-blue-900/50 transition-all">
                Create free account
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link to="/login">
              <button className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-base font-medium text-blue-100 border border-white/20 hover:bg-white/10 transition-all">
                Sign in
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer
        className="relative z-10 py-10 px-6 text-center text-sm text-blue-300/50"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <img
            src={brandLogo}
            alt="Logo"
            className="h-5 w-5 rounded opacity-80"
          />
          <span className="font-medium text-white/70">RAGNexus</span>
        </div>
        <p>
          © {new Date().getFullYear()} RAGNexus. Built with precision for
          AI-powered document intelligence.
        </p>
      </footer>
    </div>
  );
}
