import type { FC } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import logo from '../assets/Logo.png';
import heroImage from '../assets/image.png';

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

const reveal = {
  hidden: { opacity: 0, y: 36 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.56, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const stagger = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.08,
    },
  },
};

const LandingPage: FC<{ onEnter?: () => void }> = ({ onEnter }) => {
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.18], [0, -110]);
  const orbY = useTransform(scrollYProgress, [0, 0.45], [0, -220]);
  const uiY = useTransform(scrollYProgress, [0, 0.28], [0, -65]);

  const handleStartAnalyzing = () => {
    if (onEnter && typeof onEnter === 'function') {
      onEnter();
      return;
    }
    alert('Login functionality will be implemented next!');
  };

  const timeline = [
    {
      title: 'Hyper-Realistic Deepfakes',
      desc: 'AI can now generate convincing fake videos and audio that bypass human detection, enabling fraud, harassment, and political manipulation.',
    },
    {
      title: 'Erosion of Trust',
      desc: "As synthetic media proliferates, society faces a reality-apathy crisis where people distrust authentic information and evidence.",
    },
    {
      title: 'Weaponized Misinformation',
      desc: 'Bad actors deploy AI-generated content to destabilize markets, incite violence, and undermine democratic institutions at unprecedented scale.',
    },
  ];

  const featureFlow = [
    {
      title: 'Deepfake Detection Engine',
      desc: 'Analyzes micro-expressions, lighting inconsistencies, and digital artifacts invisible to the human eye.',
      stat: '99.2%',
      meta: 'Detection Accuracy',
    },
    {
      title: 'Contextual Fact Verification',
      desc: 'Cross-references claims against trusted sources using semantic analysis and real-time news aggregation.',
      stat: '1.2s',
      meta: 'Average Analysis Time',
    },
    {
      title: 'Explainable AI Reporting',
      desc: 'Returns confidence scoring, evidence highlights, and transparent reasoning you can act on.',
      stat: '47M+',
      meta: 'Media Analyzed',
    },
  ];

  return (
    <div
      className="min-h-screen overflow-x-clip bg-[#f6f6f4] text-[#111110] selection:bg-[#dfe5ff]"
      style={{ fontFamily: 'Inter, Satoshi, General Sans, ui-sans-serif, system-ui, sans-serif' }}
    >
      <style>{`
        :root {
          --line: rgba(17, 17, 16, 0.12);
          --soft: #636363;
          --accent: #7a8fff;
          --accent-soft: rgba(122, 143, 255, 0.25);
          --ease-premium: cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes driftGradient {
          0% { transform: translate3d(-8%, -6%, 0) scale(1); }
          50% { transform: translate3d(6%, 5%, 0) scale(1.08); }
          100% { transform: translate3d(-8%, -6%, 0) scale(1); }
        }
        @keyframes pulseRing {
          0% { transform: scale(0.95); opacity: 0.35; }
          50% { transform: scale(1.05); opacity: 0.7; }
          100% { transform: scale(0.95); opacity: 0.35; }
        }
        @keyframes floatCard {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        .grain {
          background-image: radial-gradient(circle at 1px 1px, rgba(17,17,16,0.09) 1px, transparent 0);
          background-size: 28px 28px;
        }
        .premium-transition {
          transition: all 500ms var(--ease-premium);
        }
      `}</style>

      <nav className="fixed inset-x-0 top-0 z-50 border-b border-[var(--line)] bg-[#f6f6f4]/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 lg:px-8">
          <a href="#" className="group flex items-center gap-2">
            <img src={logo} alt="FactGuard logo" className="h-10 w-10 rounded-full border border-black/10 object-cover" />
            <span className="text-xl font-black tracking-tight">FactGuard</span>
          </a>
          <div className="hidden items-center gap-8 text-xs font-semibold uppercase tracking-[0.18em] text-[#3e3e3d] md:flex">
            <a href="#threat" className="premium-transition hover:text-black">Threat</a>
            <a href="#experience" className="premium-transition hover:text-black">Experience</a>
            <a href="#technology" className="premium-transition hover:text-black">Technology</a>
            <a href="#impact" className="premium-transition hover:text-black">Impact</a>
          </div>
        </div>
      </nav>

      <header className="relative isolate px-5 pb-24 pt-32 lg:px-8 lg:pt-40">
        <motion.div style={{ y: orbY }} className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-[#ffffff] blur-3xl" />
        <motion.div
          style={{ y: orbY }}
          className="pointer-events-none absolute -right-8 top-10 h-96 w-96 rounded-full bg-[var(--accent-soft)] blur-3xl"
        />
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute left-1/4 top-24 h-[36rem] w-[36rem] rounded-full bg-gradient-to-br from-[#fdfdfd] via-[#ececec] to-[#d9defb] blur-3xl animate-[driftGradient_14s_ease-in-out_infinite]" />
        </div>

        <div className="mx-auto grid w-full max-w-7xl gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <motion.div
            style={{ y: heroY }}
            variants={stagger}
            initial="hidden"
            animate="show"
            className="relative z-10"
          >
            <motion.div
              variants={reveal}
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#444]"
            >
              <ShieldIcon className="h-4 w-4 text-[#5a6fff]" /> AI-Powered Verification System
            </motion.div>
            <motion.h1
              variants={reveal}
              className="mt-8 max-w-4xl text-5xl font-black uppercase leading-[0.94] tracking-[-0.03em] sm:text-7xl lg:text-[6.8rem]"
            >
              Defend Truth
              <br />
              Before It
              <br />
              Fractures.
            </motion.h1>
            <motion.p variants={reveal} className="mt-7 max-w-xl text-base leading-relaxed text-[var(--soft)] sm:text-lg">
              FactGuard combines forensic AI and contextual verification to detect deepfakes and validate news in real time. Designed to rebuild trust where it matters most.
            </motion.p>
            <motion.div variants={reveal} className="mt-10 flex flex-wrap items-center gap-4">
              <button
                onClick={handleStartAnalyzing}
                className="group inline-flex items-center gap-2 rounded-full border border-black bg-black px-7 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-white premium-transition hover:-translate-y-0.5 hover:shadow-[0_12px_35px_rgba(17,17,16,0.2)]"
              >
                Start Free Analysis
                <ArrowRightIcon className="h-4 w-4 premium-transition group-hover:translate-x-1" />
              </button>
              <a
                href="#experience"
                className="rounded-full border border-black/15 bg-white/70 px-7 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-[#252525] premium-transition hover:border-black/40 hover:bg-white"
              >
                Explore System
              </a>
            </motion.div>

            <motion.div variants={stagger} className="mt-12 flex max-w-md gap-4" initial="hidden" animate="show">
              {[
                { n: '99.2%', label: 'Detection Accuracy' },
                { n: '1.2s', label: 'Avg. Analysis Time' },
              ].map((metric) => (
                <motion.div
                  variants={reveal}
                  key={metric.label}
                  className="flex-1 rounded-2xl border border-black/10 bg-white/75 p-4 backdrop-blur-sm premium-transition hover:-translate-y-1 hover:border-black/20"
                >
                  <p className="text-2xl font-black tracking-tight">{metric.n}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.15em] text-[#5a5a58]">{metric.label}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          <motion.div style={{ y: uiY }} className="relative mx-auto w-full max-w-2xl">
            <motion.div
              whileHover={{ y: -6, scale: 1.01 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="relative overflow-hidden rounded-[2rem] border border-black/10 bg-white/85 p-3 shadow-[0_35px_80px_rgba(17,17,16,0.12)] backdrop-blur-xl"
            >
              <img src={heroImage} alt="FactGuard analysis interface" className="h-auto w-full rounded-[1.3rem] border border-black/10 object-contain" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/30 via-transparent to-white/15" />
              <div className="absolute right-4 top-4 rounded-full border border-black/15 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#373737]">
                Secure Mode Active
              </div>
            </motion.div>

            <motion.div
              animate={{ y: [0, -11, 0] }}
              transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -left-5 bottom-12 w-44 rounded-2xl border border-black/10 bg-white/90 p-4 shadow-xl"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#777]">Authenticity</p>
              <p className="mt-1 text-xl font-black">99.3%</p>
            </motion.div>
            <motion.div
              animate={{ y: [0, -7, 0] }}
              transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
              className="absolute -right-5 top-10 w-48 rounded-2xl border border-black/10 bg-white/90 p-4 shadow-xl"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#777]">Processing</p>
              <p className="mt-1 text-xl font-black">Real-Time</p>
            </motion.div>
            <div className="pointer-events-none absolute -right-8 -top-6 h-20 w-20 rounded-full bg-[var(--accent-soft)] blur-2xl animate-[pulseRing_5s_ease-in-out_infinite]" />
          </motion.div>
        </div>
      </header>

      <section id="threat" className="relative px-5 py-28 lg:px-8">
        <div className="grain absolute inset-0 opacity-[0.22]" />
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          className="relative mx-auto w-full max-w-7xl"
        >
          <motion.p variants={reveal} className="text-xs font-bold uppercase tracking-[0.2em] text-[#666]">
            The Threat
          </motion.p>
          <motion.h2 variants={reveal} className="mt-4 max-w-4xl text-4xl font-black uppercase leading-[0.95] tracking-[-0.02em] sm:text-6xl">
            Synthetic Deception Is Scaling Faster Than Public Defenses.
          </motion.h2>
          <motion.p variants={reveal} className="mt-6 max-w-2xl text-lg text-[#575755]">
            Deepfake incidents surged by 900% since 2023, forcing every institution to verify before sharing.
          </motion.p>

          <motion.div variants={stagger} className="mt-14 space-y-7">
            {timeline.map((item, i) => (
              <motion.article
                variants={reveal}
                key={item.title}
                className="group grid gap-5 border-t border-black/10 pt-7 md:grid-cols-[95px_1fr_180px]"
              >
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#7a7a7a]">{`0${i + 1}`}</p>
                <h3 className="text-2xl font-extrabold tracking-tight">{item.title}</h3>
                <p className="text-sm leading-relaxed text-[#595957] md:text-right">{item.desc}</p>
              </motion.article>
            ))}
          </motion.div>
        </motion.div>
      </section>

      <section id="experience" className="px-5 py-28 lg:px-8">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          className="mx-auto w-full max-w-7xl"
        >
          <motion.p variants={reveal} className="text-xs font-bold uppercase tracking-[0.2em] text-[#666]">
            Scroll Experience
          </motion.p>
          <motion.h2 variants={reveal} className="mt-4 max-w-5xl text-4xl font-black uppercase leading-[0.95] tracking-[-0.02em] sm:text-6xl">
            Verification Engine In Motion.
          </motion.h2>

          <motion.div
            variants={reveal}
            className="mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {[
              'Upload video, audio, image, or article URL through a secure portal.',
              'Dual AI engines run deepfake analysis and contextual fact verification in parallel.',
              'Receive explainable evidence with confidence scoring and distribution guidance.',
            ].map((text, i) => (
              <motion.div
                whileHover={{ y: -5, scale: 1.01 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                key={text}
                className="relative min-w-[78vw] snap-center rounded-[2rem] border border-black/10 bg-white/85 p-8 shadow-[0_20px_50px_rgba(17,17,16,0.08)] md:min-w-[52vw]"
              >
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#666]">{`Step 0${i + 1}`}</p>
                <p className="mt-5 max-w-md text-2xl font-semibold leading-tight">{text}</p>
                <div className="absolute bottom-8 right-8 h-16 w-16 rounded-full border border-black/10 bg-gradient-to-br from-[#fff] to-[#edf0ff]" />
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      <section id="impact" className="relative overflow-hidden px-5 py-32 lg:px-8">
        <div className="absolute inset-0 bg-gradient-to-b from-[#f2f2f0] via-[#ececeb] to-[#f8f8f7]" />
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          className="relative mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[1.1fr_0.9fr]"
        >
          <motion.div variants={reveal} className="relative">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#666]">Visual Storytelling</p>
            <h2 className="mt-5 text-5xl font-black uppercase leading-[0.92] tracking-[-0.03em] sm:text-7xl">
              Trust Is
              <br />
              A Shared
              <br />
              Interface.
            </h2>
            <p className="mt-8 max-w-xl text-lg text-[#575755]">
              FactGuard does not just detect fake media. It restores confidence in public information flows.
            </p>
          </motion.div>

          <motion.div variants={reveal} className="relative">
            <div className="absolute -left-8 top-1/2 hidden h-48 w-48 -translate-y-1/2 rounded-full bg-[var(--accent-soft)] blur-3xl lg:block" />
            <div className="relative rounded-[2.2rem] border border-black/10 bg-white/80 p-5 shadow-[0_25px_60px_rgba(17,17,16,0.09)]">
              <img src={heroImage} alt="FactGuard immersive preview" className="h-auto w-full rounded-[1.4rem] border border-black/10 object-cover" />
              <div className="absolute left-8 top-8 rounded-2xl border border-black/10 bg-white/85 px-4 py-3 text-sm font-semibold shadow-lg">
                Explainable reasoning
              </div>
              <div className="absolute bottom-8 right-8 rounded-2xl border border-black/10 bg-white/85 px-4 py-3 text-sm font-semibold shadow-lg">
                Evidence over noise
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      <section id="technology" className="px-5 py-28 lg:px-8">
        <div className="mx-auto grid w-full max-w-7xl gap-14 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="h-fit lg:sticky lg:top-24">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#666]">Feature Highlights</p>
            <h2 className="mt-4 text-4xl font-black uppercase leading-[0.95] tracking-[-0.02em] sm:text-6xl">
              Dual-Layer
              <br />
              Verification
              <br />
              Technology.
            </h2>
          </div>

          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} className="space-y-12">
            {featureFlow.map((item, index) => (
              <motion.article
                variants={reveal}
                key={item.title}
                className={`group grid gap-6 rounded-[2rem] border border-black/10 bg-white/85 p-7 premium-transition hover:-translate-y-1 hover:shadow-xl sm:p-10 ${
                  index % 2 ? 'lg:grid-cols-[1fr_0.8fr]' : 'lg:grid-cols-[0.8fr_1fr]'
                }`}
              >
                <div className={index % 2 ? 'lg:order-2' : ''}>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#666]">{`Layer 0${index + 1}`}</p>
                  <h3 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight">{item.title}</h3>
                  <p className="mt-4 max-w-lg text-[#5a5a58]">{item.desc}</p>
                </div>
                <div className={`${index % 2 ? 'lg:order-1' : ''} relative rounded-[1.5rem] border border-black/10 bg-gradient-to-br from-[#fafafa] to-[#eceef8] p-7`}>
                  <div className="absolute right-5 top-5 h-3 w-3 rounded-full bg-[var(--accent)]" />
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#6b6b6b]">{item.meta}</p>
                  <p className="mt-4 text-5xl font-black tracking-tight">{item.stat}</p>
                  <div className="mt-8 h-2 w-full overflow-hidden rounded-full bg-black/10">
                    <motion.div
                      initial={{ width: '22%' }}
                      whileInView={{ width: '88%' }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                      className="h-full rounded-full bg-gradient-to-r from-[#111] to-[#7a8fff]"
                    />
                  </div>
                </div>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="relative px-5 pb-28 pt-10 lg:px-8">
        <div className="absolute inset-0 bg-gradient-to-br from-[#ececeb] via-[#f6f6f4] to-[#e8ebfb]" />
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          className="relative mx-auto w-full max-w-5xl rounded-[2.4rem] border border-black/10 bg-white/70 px-8 py-20 text-center shadow-[0_22px_60px_rgba(17,17,16,0.1)] backdrop-blur-sm sm:px-14"
        >
          <div className="pointer-events-none absolute left-1/2 top-0 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent-soft)] blur-3xl" />
          <motion.p variants={reveal} className="text-xs font-bold uppercase tracking-[0.2em] text-[#666]">
            Final Call
          </motion.p>
          <motion.h2 variants={reveal} className="mt-6 text-4xl font-black uppercase leading-[0.95] tracking-[-0.02em] sm:text-6xl">
            Verify Before
            <br />
            You Amplify.
          </motion.h2>
          <motion.p variants={reveal} className="mx-auto mt-6 max-w-2xl text-lg text-[#575755]">
            One click starts your first free analysis and returns a full explainable authenticity report.
          </motion.p>
          <motion.div variants={reveal} className="mt-10">
            <button
              onClick={handleStartAnalyzing}
              className="group inline-flex items-center gap-2 rounded-full border border-black bg-black px-9 py-4 text-sm font-semibold uppercase tracking-[0.13em] text-white premium-transition hover:-translate-y-0.5 hover:shadow-[0_12px_35px_rgba(17,17,16,0.22)]"
            >
              Start Your Free Analysis
              <ArrowRightIcon className="h-4 w-4 premium-transition group-hover:translate-x-1" />
            </button>
          </motion.div>
        </motion.div>
      </section>
    </div>
  );
};

export default LandingPage;
