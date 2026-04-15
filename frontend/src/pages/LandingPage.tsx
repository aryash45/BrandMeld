import React from 'react';

interface LandingPageProps {
  onLoginClick: () => void;
}

const FeatureCard: React.FC<{ title: string; desc: string; icon: React.ReactNode }> = ({
  title,
  desc,
  icon,
}) => (
  <div className="border-2 border-white bg-black p-8 group hover:bg-white hover:text-black transition-colors min-h-[220px] flex flex-col items-start gap-4">
    <div className="text-brand-cyan group-hover:text-black transition-colors">
      {icon}
    </div>
    <h3 className="font-headline text-xl font-bold uppercase tracking-tight">{title}</h3>
    <p className="text-sm leading-relaxed font-label">{desc}</p>
  </div>
);

const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick }) => {
  return (
    <div className="font-body relative flex min-h-screen flex-col items-center bg-black text-white selection:bg-brand-yellow selection:text-black overflow-x-hidden">
      {/* Navbar Grid Lines */}
      <div className="fixed inset-0 pointer-events-none opacity-20 border-l border-r border-white/20 w-full max-w-7xl mx-auto mix-blend-overlay"></div>
      
      <div className="z-10 w-full max-w-7xl px-6 pb-20 sm:px-8 lg:px-12">
        <nav className="flex items-center justify-between py-8 border-b-2 border-white mb-16">
          <div className="flex items-center gap-3">
            <div className="font-headline text-2xl font-black italic tracking-tighter uppercase">
              DISTRIBUTION_ENGINE
            </div>
            <span className="font-label text-[10px] text-brand-cyan">V.02-ALPHA</span>
          </div>
          <button
            onClick={onLoginClick}
            className="border-2 border-white bg-black px-6 py-2 font-headline font-bold uppercase text-white hover:bg-white hover:text-black transition-colors"
          >
            SYS_LOGIN
          </button>
        </nav>

        <header className="mb-24 text-left">
          <div className="mb-6 inline-flex items-center gap-2 border-2 border-brand-yellow bg-black px-3 py-1 text-xs font-label uppercase text-brand-yellow neo-shadow-yellow">
            <span className="w-2 h-2 bg-brand-yellow rounded-none animate-pulse"></span>
            ROOT_ACCESS // Founders & Creators
          </div>
          <h1 className="font-headline mb-8 text-5xl md:text-7xl lg:text-[7rem] font-black leading-[0.9] tracking-tighter uppercase italic py-2">
            OVERRIDE YOUR <br className="hidden sm:block" />
            <span className="text-brand-cyan">DISTRIBUTION.</span>
          </h1>
          <div className="max-w-2xl border-l-4 border-brand-yellow pl-6 mb-12">
            <p className="text-lg leading-relaxed font-label text-slate-300 uppercase">
              // NO NOISE. NO GHOSTWRITERS. <br/>
              GENERATE RAW, HIGH-SIGNAL CONTENT THAT REFLECTS YOUR UNIQUE IDENTITY DIRECTLY ACROSS ALL SYSTEMS 
              INSTANTLY.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <button
              onClick={onLoginClick}
              className="w-full sm:w-auto bg-brand-yellow text-black px-10 py-5 font-headline font-black text-xl uppercase border-2 border-black neo-shadow hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_white] transition-all flex items-center justify-center gap-4 group"
            >
              INITIALIZE_SEQUENCE
              <span className="material-symbols-outlined font-bold group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </button>
            <button
              onClick={onLoginClick}
              className="w-full sm:w-auto border-2 border-white bg-black px-10 py-5 font-headline font-bold text-xl text-white uppercase hover:bg-white hover:text-black transition-all flex items-center justify-center gap-3"
            >
              <span className="material-symbols-outlined">settings_voice</span>
              INPUT_DNA
            </button>
          </div>
        </header>

        {/* Marquee effect for platforms */}
        <div className="mb-24 border-y-2 border-white py-6 overflow-hidden bg-brand-yellow text-black flex items-center">
          <div className="font-headline font-black text-2xl uppercase tracking-tighter whitespace-nowrap flex gap-12 sm:gap-24 items-center -ml-12 animate-[shimmer_15s_linear_infinite]">
            {['X.COM', 'LINKEDIN_NETWORK', 'INSTAGRAM', 'SUBSTACK_PROTO', 'MEDIUM'].map((platform, i) => (
              <React.Fragment key={platform}>
                <span>{platform}</span>
                <span className="text-black/50 text-3xl">/</span>
              </React.Fragment>
            ))}
             {['X.COM', 'LINKEDIN_NETWORK', 'INSTAGRAM', 'SUBSTACK_PROTO', 'MEDIUM'].map((platform, i) => (
              <React.Fragment key={`${platform}-clone`}>
                <span>{platform}</span>
                <span className="text-black/50 text-3xl">/</span>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="mb-32 grid grid-cols-1 md:grid-cols-3 gap-0 border-2 border-white bg-black">
          <div className="md:border-r-2 border-b-2 md:border-b-0 border-white">
            <FeatureCard
              title="VOICE_CLONING"
              desc="PASTE YOUR DATA. ENGINE DECONSTRUCTS SYNTAX, TONE, AND VOCABULARY TO BUILD A CUSTOM IDENTITY MODEL."
              icon={<span className="material-symbols-outlined text-4xl">psychology</span>}
            />
          </div>
          <div className="md:border-r-2 border-b-2 md:border-b-0 border-white">
            <FeatureCard
              title="DOMAIN_AUTHORITY"
              desc="GENERATE HIGH-IMPACT THREADS, RANTS, AND STORIES THAT ESTABLISH PURE DOMAIN DOMINANCE."
              icon={<span className="material-symbols-outlined text-4xl">track_changes</span>}
            />
          </div>
          <div>
             <FeatureCard
              title="CONSISTENCY_AUDIT"
              desc="MANDATORY SELF-CORRECTION LOOP ENSURES CONTENT ALIGNS 100% WITH YOUR CORE IDENTITY VECTORS BEFORE PUBLISHING."
              icon={<span className="material-symbols-outlined text-4xl">verified_user</span>}
            />
          </div>
        </div>

        <div className="mb-24 flex flex-col lg:flex-row border-2 border-white bg-surface-container-lowest">
          <div className="lg:w-1/2 p-8 lg:p-12 border-b-2 lg:border-b-0 lg:border-r-2 border-white">
            <div className="font-label text-xs text-brand-cyan mb-4">[SYSTEM_ARCHITECTURE]</div>
            <h2 className="font-headline mb-8 text-4xl font-black uppercase italic tracking-tighter text-white">
              BUILT FOR SCALE.<br/>
              DESIGNED FOR SPEED.
            </h2>
            <p className="mb-8 font-label text-sm text-slate-400 leading-relaxed uppercase">
              BrandMeld ignores formatting overhead to bridge the gap between ideation and distribution. Scale your output signal without corrupting your identity.
            </p>
            <div className="grid grid-cols-1 gap-4 font-label text-xs">
              {['Founder_Updates', 'Viral_Threads', 'Platform_Storytelling', 'Course_Launches'].map(label => (
                <div key={label} className="border border-white/20 p-3 bg-black flex items-center justify-between">
                  <span className="uppercase">{label}</span>
                  <span className="text-brand-yellow">✓</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="lg:w-1/2 p-8 lg:p-12 relative overflow-hidden flex items-center justify-center">
            {/* Terminal preview graphic */}
            <div className="w-full absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMC41Ii8+PC9zdmc+')]"></div>
            
            <div className="relative z-10 w-full border-2 border-brand-cyan bg-black p-6 neo-shadow">
              <div className="flex items-center justify-between border-b-2 border-brand-cyan pb-2 mb-4">
                 <span className="font-label text-xs text-brand-cyan font-bold">TERMINAL // ENGINE_OUTPUT</span>
                 <div className="flex gap-2">
                   <div className="w-3 h-3 bg-white"></div>
                   <div className="w-3 h-3 bg-brand-yellow"></div>
                   <div className="w-3 h-3 bg-brand-cyan"></div>
                 </div>
              </div>
              <div className="font-label text-xs text-white/50 space-y-2 uppercase">
                <p>&gt; INITIALIZING GENERATION LOOP...</p>
                <p>&gt; EXTRACTING VOICE DNA...</p>
                <p>&gt; ALLOCATING PLATFORM TARGETS: X, LINKEDIN</p>
                <p className="text-brand-yellow animate-pulse">&gt; YIELDING PAYLOAD...</p>
              </div>
            </div>
          </div>
        </div>

        <footer className="border-t-2 border-white py-8 flex flex-col sm:flex-row justify-between items-center font-label text-xs uppercase text-slate-500">
          <p>&copy; {new Date().getFullYear()} DISTRIBUTION_ENGINE.</p>
          <p>SYS_STATUS: ONLINE</p>
        </footer>
      </div>
    </div>
  );
};

export default LandingPage;
