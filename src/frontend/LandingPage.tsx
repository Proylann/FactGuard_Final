import type { FC, ReactNode } from 'react';
import { motion } from 'framer-motion';
import logo from '../assets/Logo.png';

type IconProp = FC<{ className?: string }>;

const ArrowRightIcon: IconProp = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
  </svg>
);

const ShieldIcon: IconProp = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const CheckIcon: IconProp = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const NavLink: FC<{ href: string; children: ReactNode }> = ({ href, children }) => (
  <a href={href} className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500 hover:text-slate-900 transition-colors">
    {children}
  </a>
);

const WireCard: FC<{ title: string; text: string }> = ({ title, text }) => (
  <div className="rounded-2xl border border-slate-300/70 bg-white/80 p-5 shadow-[0_10px_35px_-25px_rgba(15,23,42,0.7)]">
    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</p>
    <p className="mt-2 text-sm leading-6 text-slate-700">{text}</p>
  </div>
);

const HeroSignalSvg: FC = () => (
  <svg viewBox="0 0 480 300" className="h-56 w-full md:h-64" role="img" aria-label="Animated threat signal wireframe">
    <defs>
      <linearGradient id="gridStroke" x1="0%" x2="100%" y1="0%" y2="0%">
        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.2" />
        <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.55" />
      </linearGradient>
      <linearGradient id="scanFill" x1="0%" x2="100%" y1="0%" y2="0%">
        <stop offset="0%" stopColor="#34d399" stopOpacity="0" />
        <stop offset="50%" stopColor="#34d399" stopOpacity="0.7" />
        <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
      </linearGradient>
    </defs>
    <rect x="8" y="8" width="464" height="284" rx="18" fill="#0f172a" />
    <rect x="8" y="8" width="464" height="284" rx="18" fill="none" stroke="url(#gridStroke)" strokeWidth="1.5" />
    {Array.from({ length: 8 }).map((_, i) => (
      <line key={`h-${i}`} x1="32" y1={40 + i * 30} x2="448" y2={40 + i * 30} stroke="#334155" strokeWidth="1" />
    ))}
    {Array.from({ length: 10 }).map((_, i) => (
      <line key={`v-${i}`} x1={42 + i * 40} y1="30" x2={42 + i * 40} y2="270" stroke="#1e293b" strokeWidth="1" />
    ))}
    <path
      d="M36 208 C90 190, 124 126, 168 144 C206 159, 220 220, 272 210 C316 201, 344 86, 388 96 C410 101, 430 122, 446 134"
      fill="none"
      stroke="#38bdf8"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="hero-signal-path"
    />
    <path
      d="M36 218 C92 206, 118 176, 162 182 C200 187, 230 240, 270 236 C320 232, 348 132, 398 146 C416 151, 432 164, 446 176"
      fill="none"
      stroke="#22d3ee"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray="7 11"
      className="hero-signal-path-slow"
    />
    <rect x="24" y="24" width="432" height="252" fill="url(#scanFill)" className="hero-scan-bar" />
    <circle cx="388" cy="96" r="8" fill="#f43f5e" className="hero-pulse-danger" />
    <circle cx="168" cy="144" r="7" fill="#f59e0b" className="hero-pulse-warning" />
    <circle cx="272" cy="210" r="6" fill="#34d399" className="hero-pulse-safe" />
    <text x="30" y="44" fill="#e2e8f0" fontSize="12" fontWeight="700" letterSpacing="1.3">
      LIVE SIGNAL MAP
    </text>
  </svg>
);

const LandingPage: FC<{ onEnter?: () => void }> = ({ onEnter }) => {
  const handleStartAnalyzing = () => {
    if (onEnter) {
      onEnter();
      return;
    }
    alert('Authentication flow is not connected in this mode.');
  };

  return (
    <div className="min-h-screen bg-[#f7fbff] text-slate-900">
      <style>{`
        @keyframes signalMove {
          0% { stroke-dashoffset: 230; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes signalMoveSlow {
          0% { stroke-dashoffset: 400; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes scanSweep {
          0% { transform: translateX(-84%); }
          100% { transform: translateX(84%); }
        }
        @keyframes pulseDanger {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(1.35); }
        }
        @keyframes pulseWarning {
          0%, 100% { opacity: 0.85; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.2); }
        }
        .hero-signal-path {
          stroke-dasharray: 11 9;
          animation: signalMove 4.8s linear infinite;
        }
        .hero-signal-path-slow {
          animation: signalMoveSlow 7.2s linear infinite;
        }
        .hero-scan-bar {
          animation: scanSweep 3.6s ease-in-out infinite alternate;
        }
        .hero-pulse-danger {
          transform-origin: center;
          animation: pulseDanger 1.6s ease-in-out infinite;
        }
        .hero-pulse-warning {
          transform-origin: center;
          animation: pulseWarning 2.1s ease-in-out infinite;
        }
        .hero-pulse-safe {
          transform-origin: center;
          animation: pulseWarning 2.7s ease-in-out infinite;
        }
      `}</style>

      <nav className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <img src={logo} alt="FactGuard logo" className="h-9 w-9 rounded-md object-cover" />
            <p className="text-xl font-black tracking-tight">
              Fact<span className="text-sky-700">Guard</span>
            </p>
          </div>
          <div className="hidden items-center gap-7 md:flex">
            <NavLink href="#wireframe">Wireframe</NavLink>
            <NavLink href="#copy">Copy Blocks</NavLink>
            <NavLink href="#prototype">Dashboard</NavLink>
          </div>
          <button
            onClick={handleStartAnalyzing}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-900 hover:text-slate-900"
          >
            Enter App
          </button>
        </div>
      </nav>

      <header className="relative overflow-hidden px-4 pb-16 pt-12 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(14,165,233,0.17),transparent_36%),radial-gradient(circle_at_80%_25%,rgba(34,197,94,0.15),transparent_28%)]" />
        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
            <p className="inline-flex rounded-full border border-slate-300/70 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
              Wireframe + Conversion Copy
            </p>
            <h1 className="mt-5 max-w-xl text-4xl font-extrabold leading-tight sm:text-5xl">
              Detect synthetic media in minutes before it damages trust.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              FactGuard screens video, audio, and breaking claims in one workflow so teams can publish with confidence, move faster, and reduce costly
              false alarms.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleStartAnalyzing}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Start Free Verification
                <ArrowRightIcon className="h-4 w-4" />
              </button>
              <a
                href="#prototype"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-900"
              >
                View Dashboard Prototype
              </a>
            </div>
            <div className="mt-8 grid max-w-lg grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl border border-slate-300/70 bg-white p-4">
                <p className="text-2xl font-extrabold text-slate-900">96.8%</p>
                <p className="mt-1 text-slate-500">Precision</p>
              </div>
              <div className="rounded-xl border border-slate-300/70 bg-white p-4">
                <p className="text-2xl font-extrabold text-slate-900">84 sec</p>
                <p className="mt-1 text-slate-500">Median scan</p>
              </div>
              <div className="rounded-xl border border-slate-300/70 bg-white p-4">
                <p className="text-2xl font-extrabold text-slate-900">24/7</p>
                <p className="mt-1 text-slate-500">Monitoring</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            id="prototype"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="rounded-3xl border border-slate-300/70 bg-white p-4 shadow-[0_25px_70px_-35px_rgba(15,23,42,0.7)] sm:p-5"
          >
            <div className="rounded-2xl border border-slate-300 bg-slate-950 p-3">
              <div className="mb-3 flex items-center justify-between px-2 text-xs font-semibold text-slate-300">
                <span>Threat Feed Console</span>
                <span className="rounded-md border border-emerald-600/60 px-2 py-1 text-emerald-400">Live</span>
              </div>
              <HeroSignalSvg />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-300 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Current Alert</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">Possible synthetic segment at 01:24</p>
                <div className="mt-3 h-2 rounded-full bg-slate-100">
                  <div className="h-2 w-2/3 rounded-full bg-amber-400" />
                </div>
              </div>
              <div className="rounded-xl border border-slate-300 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Verdict Confidence</p>
                <p className="mt-2 text-2xl font-extrabold text-slate-900">91%</p>
                <p className="text-xs text-slate-500">Needs editor confirmation</p>
              </div>
            </div>
          </motion.div>
        </div>
      </header>

      <section id="wireframe" className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Landing Page Wireframe</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Built to move visitors from awareness to action.</h2>
          <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <WireCard title="1. Hook" text="High-stakes headline + immediate CTA above the fold to capture urgency." />
            <WireCard title="2. Pain" text="Short narrative that quantifies risk of deepfakes and delayed verification." />
            <WireCard title="3. Proof" text="Dashboard screenshot pattern with confidence scores and explainable output." />
            <WireCard title="4. Offer" text="Risk-free trial message with clear next step and zero-friction onboarding." />
          </div>
        </div>
      </section>

      <section id="copy" className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-7xl gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-300/70 bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Conversion Copy</p>
            <h3 className="mt-2 text-xl font-extrabold">Primary message stack</h3>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              <li>
                <span className="font-semibold text-slate-900">Headline:</span> Verify what is real before your audience decides for you.
              </li>
              <li>
                <span className="font-semibold text-slate-900">Subheadline:</span> One platform to detect manipulated media, fact-check claims, and publish findings with
                confidence.
              </li>
              <li>
                <span className="font-semibold text-slate-900">Primary CTA:</span> Start Free Verification.
              </li>
              <li>
                <span className="font-semibold text-slate-900">Secondary CTA:</span> See Detection Workflow.
              </li>
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-300/70 bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Trust and urgency copy</p>
            <h3 className="mt-2 text-xl font-extrabold">Supporting blocks</h3>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              <li>
                <span className="font-semibold text-slate-900">Proof line:</span> Analysts reduced verification time by 63% in the first month.
              </li>
              <li>
                <span className="font-semibold text-slate-900">Risk line:</span> Every minute unverified media stays live increases reputational fallout.
              </li>
              <li>
                <span className="font-semibold text-slate-900">Offer line:</span> 10 free scans, no credit card, full evidence reports included.
              </li>
              <li>
                <span className="font-semibold text-slate-900">Footer CTA:</span> Deploy FactGuard before the next breaking story.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-6 rounded-3xl border border-slate-300/70 bg-slate-900 p-8 text-slate-100 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Ready to launch</p>
            <h3 className="mt-2 text-2xl font-extrabold">Turn this prototype into your live onboarding funnel.</h3>
            <p className="mt-2 text-sm text-slate-300">Keep the wireframe structure, swap your live metrics, and connect trial signup in one sprint.</p>
          </div>
          <button
            onClick={handleStartAnalyzing}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
          >
            Launch Free Trial
            <CheckIcon className="h-4 w-4" />
          </button>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-4 py-7 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-4 text-sm text-slate-500 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <ShieldIcon className="h-4 w-4 text-slate-700" />
            <span>FactGuard</span>
          </div>
          <p>Built for media teams, risk analysts, and trust and safety workflows.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
