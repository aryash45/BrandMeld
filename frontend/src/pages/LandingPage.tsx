import React from 'react';

interface LandingPageProps {
  onLoginClick: () => void;
}

const FeatureCard: React.FC<{ title: string; desc: string; icon: React.ReactNode }> = ({
  title,
  desc,
  icon,
}) => (
  <div className="group rounded-2xl border border-slate-800 bg-slate-900/50 p-8 transition-all duration-300 hover:border-teal-500/30 hover:bg-slate-800/80">
    <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-teal-400 transition-transform duration-300 group-hover:scale-110">
      {icon}
    </div>
    <h3 className="font-display mb-3 text-xl font-bold text-slate-100">{title}</h3>
    <p className="text-sm leading-relaxed text-slate-400">{desc}</p>
  </div>
);

const UseCaseItem: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-3 text-slate-300">
    <svg className="h-5 w-5 shrink-0 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
    <span>{label}</span>
  </div>
);

const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick }) => {
  return (
    <div className="font-body relative flex min-h-screen flex-col items-center overflow-x-hidden bg-slate-950 selection:bg-teal-500/30">
      <div className="pointer-events-none fixed left-0 top-0 z-0 h-full w-full overflow-hidden">
        <div className="absolute left-[-10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[600px] w-[600px] rounded-full bg-teal-600/10 blur-[120px]" />
      </div>

      <div className="z-10 w-full max-w-7xl px-6 pb-20 sm:px-8 lg:px-12">
        <nav className="flex items-center justify-between py-8 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg shadow-teal-500/20" />
            <span className="font-display text-xl font-bold tracking-tight text-slate-100">
              BrandMeld
            </span>
          </div>
          <button
            onClick={onLoginClick}
            className="rounded-full border border-slate-800 px-5 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            Log In
          </button>
        </nav>

        <header className="mt-16 mb-20 animate-fade-in text-center sm:mt-24">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-800/50 bg-teal-900/30 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-teal-400">
            For Founders & Creators
          </div>
          <h1 className="font-display mb-8 text-5xl font-bold leading-tight tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-200 to-slate-500 sm:text-7xl lg:text-8xl">
            Scale Your <br className="hidden sm:block" />
            <span className="text-white">Personal Brand.</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl">
            Stop sounding like a corporation. Generate authentic, high-impact content that mirrors
            your unique voice, opinions, and writing style.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              onClick={onLoginClick}
              className="w-full rounded-xl bg-teal-600 px-8 py-4 text-base font-bold text-white shadow-xl shadow-teal-900/20 transition-all duration-200 hover:-translate-y-1 hover:bg-teal-500 sm:w-auto"
            >
              Start Writing Free
            </button>
            <button
              onClick={onLoginClick}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-8 py-4 text-base font-bold text-slate-300 transition-all duration-200 hover:bg-slate-800 sm:w-auto"
            >
              Analyze My Voice
            </button>
          </div>
        </header>

        <div className="mb-24 flex flex-col items-center border-y border-slate-800/60 py-8 animate-fade-in delay-100">
          <p className="mb-6 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Optimized for platforms
          </p>
          <div className="flex flex-wrap justify-center gap-8 opacity-50 grayscale transition-all duration-500 hover:grayscale-0 sm:gap-16">
            {['LinkedIn', 'Twitter / X', 'Substack', 'Medium', 'Instagram'].map((platform) => (
              <span key={platform} className="text-lg font-bold text-slate-300">
                {platform}
              </span>
            ))}
          </div>
        </div>

        <div className="mb-32 grid grid-cols-1 gap-6 md:grid-cols-3 lg:gap-8">
          <FeatureCard
            title="Voice Cloning"
            desc="Paste your website, blog, or previous posts. Our AI deconstructs your syntax, tone, and vocabulary to build a custom model of you."
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }
          />
          <FeatureCard
            title="Thought Leadership"
            desc="Move beyond generic marketing copy. Generate hot takes, deep-dive threads, and storytelling posts that position you as an authority."
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
          />
          <FeatureCard
            title="Consistency Audit"
            desc="Ensure every piece of content aligns with your personal brand. Get an instant score and actionable feedback before you hit publish."
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </div>

        <div className="mb-24 grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
          <div>
            <h2 className="font-display mb-6 text-3xl font-bold text-slate-100 sm:text-4xl">
              Designed for the Modern Creator.
            </h2>
            <p className="mb-8 text-lg text-slate-400">
              Building a personal brand requires volume and quality. BrandMeld bridges the gap,
              allowing you to scale your output without losing your soul.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <UseCaseItem label="Founder Updates" />
              <UseCaseItem label="Viral Twitter Threads" />
              <UseCaseItem label="LinkedIn Storytelling" />
              <UseCaseItem label="Newsletter Editions" />
              <UseCaseItem label="Course Launches" />
              <UseCaseItem label="Podcast Shownotes" />
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-teal-500/20 blur-3xl" />
            <div className="relative rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
              <div className="mb-4 flex items-center gap-4 border-b border-slate-800 pb-4">
                <div className="h-10 w-10 rounded-full bg-slate-700" />
                <div>
                  <div className="mb-2 h-3 w-24 rounded bg-slate-700" />
                  <div className="h-2 w-16 rounded bg-slate-800" />
                </div>
              </div>
              <div className="space-y-3">
                <div className="h-2 w-full rounded bg-slate-800" />
                <div className="h-2 w-full rounded bg-slate-800" />
                <div className="h-2 w-3/4 rounded bg-slate-800" />
                <div className="flex h-20 w-full items-center justify-center rounded border border-teal-900/30 bg-teal-900/20 font-mono text-sm text-teal-500">
                  &gt; Generated in your voice...
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="border-t border-slate-800/50 pt-12 text-center text-sm text-slate-600">
          <p>&copy; {new Date().getFullYear()} BrandMeld. Built for Personal Brands.</p>
        </footer>
      </div>
    </div>
  );
};

export default LandingPage;
