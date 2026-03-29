const C = {
  bg: "#ffffff",
  surface: "#fafafa",      // zinc-50
  border: "#e4e4e7",       // zinc-200
  borderLight: "#d4d4d8",  // zinc-300
  textPrimary: "#18181b",  // zinc-900
  textSecondary: "#52525b", // zinc-600
  textMuted: "#71717a",    // zinc-500
  textDim: "#a1a1aa",      // zinc-400
  serif: "'Cormorant Garamond', Georgia, serif",
  sans: "'DM Sans', system-ui, sans-serif",
};

const btn: React.CSSProperties = {
  background: C.textPrimary,
  color: "#ffffff",
  border: "none",
  borderRadius: "8px",
  padding: "13px 32px",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
  letterSpacing: "0.03em",
  fontFamily: C.sans,
  transition: "opacity 0.15s",
};

export default function Login() {
  const signIn = () => {
    window.location.href = "/api/auth/login";
  };

  return (
    <div style={{ fontFamily: C.sans, background: C.bg, color: C.textPrimary, minHeight: "100vh" }}>

      {/* Nav */}
      <nav style={{
        borderBottom: `1px solid ${C.border}`,
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(12px)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: C.serif, fontSize: 22, fontWeight: 600, color: C.textPrimary }}>
              Socratic
            </span>
            <span className="lp-nav-byline" style={{ fontSize: 12, color: C.textDim }}>
              an{" "}
              <a
                href="https://github.com/nberk/socratic"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: C.textMuted, textDecoration: "underline", textUnderlineOffset: 2, textDecorationColor: C.border }}
                onMouseEnter={e => (e.currentTarget.style.color = C.textSecondary)}
                onMouseLeave={e => (e.currentTarget.style.color = C.textMuted)}
              >
                open source
              </a>
              {" "}tool by{" "}
              <a
                href="https://nick-berk.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: C.textMuted, textDecoration: "underline", textUnderlineOffset: 2, textDecorationColor: C.border }}
                onMouseEnter={e => (e.currentTarget.style.color = C.textSecondary)}
                onMouseLeave={e => (e.currentTarget.style.color = C.textMuted)}
              >
                nick berk
              </a>
            </span>
          </div>
          <button
            onClick={signIn}
            style={{ ...btn, padding: "9px 22px", fontSize: 13 }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            Sign in →
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="lp-hero" style={{ maxWidth: 1100, margin: "0 auto", padding: "112px 24px 96px" }}>
        <p style={{ fontSize: 11, letterSpacing: "0.15em", color: C.textDim, fontWeight: 500, textTransform: "uppercase", marginBottom: 36 }}>
          AI · Spaced Repetition · Socratic Method
        </p>
        <h1 style={{ fontFamily: C.serif, fontSize: "clamp(52px, 7.5vw, 92px)", lineHeight: 1.04, fontWeight: 600, color: C.textPrimary, margin: 0 }}>
          Think it through.
        </h1>
        <h1 style={{ fontFamily: C.serif, fontSize: "clamp(52px, 7.5vw, 92px)", lineHeight: 1.04, fontWeight: 400, fontStyle: "italic", color: C.textDim, margin: "0 0 40px" }}>
          Then make it stick.
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.75, color: C.textSecondary, maxWidth: 500, marginBottom: 52 }}>
          A personal tutor that teaches the way Socrates did — by asking the right
          questions. Then locks in what you learn with science-backed spaced repetition.
        </p>
        <button onClick={signIn} style={btn} onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")} onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
          Log in
        </button>
      </section>

      {/* How it works */}
      <section className="lp-section" style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: "80px 0" }}>
        <div className="lp-section-inner" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
          <p style={{ fontSize: 13, letterSpacing: "0.08em", color: C.textSecondary, fontWeight: 600, textTransform: "uppercase", marginBottom: 56 }}>
            How it works
          </p>
          <div className="lp-grid-3">
            {[
              { n: "01", title: "Pick any topic", body: "Start a lesson on anything you want to learn — from distributed systems to music theory." },
              { n: "02", title: "Learn through dialogue", body: "An AI tutor asks targeted questions that guide you to discover concepts on your own." },
              { n: "03", title: "Review & retain", body: "Concepts you demonstrate understanding of become review cards, scheduled to maximize long-term retention." },
            ].map(s => (
              <div key={s.n}>
                <div style={{ borderTop: `2px solid ${C.textPrimary}`, paddingTop: 20, marginBottom: 18 }}>
                  <span style={{ fontFamily: C.serif, fontSize: 28, color: C.textPrimary, fontWeight: 700, lineHeight: 1 }}>{s.n}</span>
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary, marginBottom: 10, lineHeight: 1.3 }}>{s.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.75, color: C.textSecondary, margin: 0 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="lp-section" style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px" }}>
        <div className="lp-grid-2">
          {[
            { title: "Socratic dialogue", body: "No lectures, no walls of text. Your tutor asks questions that make you think — catching misconceptions in real time and guiding you toward genuine understanding." },
            { title: "Automatic concept extraction", body: "When you demonstrate understanding during a lesson, key concepts are captured automatically — complete with review questions. No manual flashcard creation." },
            { title: "FSRS spaced repetition", body: "Reviews are scheduled by the FSRS algorithm — the most accurate open-source spaced repetition scheduler — targeting 90% long-term retention." },
            { title: "AI-powered grading", body: "Type your answer in your own words. AI evaluates your core understanding — not keyword matching — and gives constructive feedback on every response." },
          ].map(f => (
            <div key={f.title} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 36 }}>
              <h3 style={{ fontFamily: C.serif, fontSize: 22, fontWeight: 600, color: C.textPrimary, marginBottom: 12, lineHeight: 1.2 }}>{f.title}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.8, color: C.textSecondary, margin: 0 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FSRS explainer */}
      <section className="lp-section" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px" }}>
        <div className="lp-grid-sidebar">
          <div>
            <p style={{ fontSize: 11, letterSpacing: "0.12em", color: C.textDim, fontWeight: 500, textTransform: "uppercase", marginBottom: 16 }}>
              How reviews are scheduled
            </p>
            <h2 style={{ fontFamily: C.serif, fontSize: "clamp(28px, 3vw, 40px)", fontWeight: 600, color: C.textPrimary, lineHeight: 1.15, margin: "0 0 40px" }}>
              The algorithm that remembers how you forget
            </h2>
            <p style={{ fontSize: 13, lineHeight: 1.8, color: C.textSecondary, borderTop: `1px solid ${C.border}`, paddingTop: 24, margin: 0 }}>
              FSRS (Free Spaced Repetition Scheduler) is an open-source algorithm trained on over 500 million real review sessions. It improves on older systems like SM-2 by modeling two properties per card — stability and difficulty — rather than applying a fixed interval multiplier. The result is fewer reviews needed to hit the same retention target, with schedules that adapt to how your memory actually behaves.
            </p>
          </div>
          <div className="lp-grid-2-inner" style={{ paddingTop: 4 }}>
            {[
              {
                label: "01",
                title: "Every card has a stability score",
                body: "After each review, the app tracks how long you can go before you'd forget that concept. Answer confidently and that window grows — weeks, then months, then years.",
              },
              {
                label: "02",
                title: "Difficulty is personal",
                body: "Some things just stick faster for you than others. FSRS adjusts each card's schedule to your history with it, not a one-size-fits-all interval.",
              },
              {
                label: "03",
                title: "Reviews land at the right moment",
                body: "Too early and you waste time reviewing something you already know. Too late and you've already lost it. FSRS targets the exact moment your memory is about to slip.",
              },
              {
                label: "04",
                title: "Less time, stronger memory",
                body: "Because reviews are spaced optimally, you spend far less time reviewing than with cramming or fixed intervals — and retain far more. The goal is 90% long-term retention.",
              },
            ].map(item => (
              <div key={item.label} style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
                <p style={{ fontFamily: C.serif, fontSize: 28, color: C.textPrimary, fontWeight: 700, lineHeight: 1, marginBottom: 14 }}>{item.label}</p>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 8, lineHeight: 1.4 }}>{item.title}</h3>
                <p style={{ fontSize: 13, lineHeight: 1.75, color: C.textSecondary, margin: 0 }}>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: "24px", textAlign: "center" }}>
        <p style={{ fontFamily: C.serif, fontSize: "clamp(14px, 1.5vw, 18px)", fontWeight: 600, color: C.textDim, letterSpacing: "0.01em", margin: 0 }}>
          An{" "}
          <a
            href="https://github.com/nberk/socratic"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: C.textMuted, textDecoration: "underline", textUnderlineOffset: 2, textDecorationColor: C.borderLight }}
            onMouseEnter={e => (e.currentTarget.style.color = C.textSecondary)}
            onMouseLeave={e => (e.currentTarget.style.color = C.textMuted)}
          >
            open source
          </a>
          {" "}tool by{" "}
          <a
            href="https://nick-berk.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: C.textMuted, textDecoration: "underline", textUnderlineOffset: 2, textDecorationColor: C.borderLight }}
            onMouseEnter={e => (e.currentTarget.style.color = C.textSecondary)}
            onMouseLeave={e => (e.currentTarget.style.color = C.textMuted)}
          >
            nick berk
          </a>
          .
        </p>
      </footer>
    </div>
  );
}
