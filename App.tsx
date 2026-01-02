
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { NewsArticle, NewsInsight, UserProfile } from './types';
import { CATEGORIES, Icons, LANGUAGES } from './constants';
import { fetchNewsFromAI, generateNewsAudio, decodeAudioData, analyzeUserInterests } from './services/geminiService';
import NewsCard from './components/NewsCard';
import TrendingChart from './components/TrendingChart';
import LiveAnchor from './components/LiveAnchor';

type AuthMode = 'LOGIN' | 'SIGNUP';
type AuthStage = 'FORM' | 'ANALYZING' | 'COMPLETED';

const App: React.FC = () => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('shortz_profile');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [authMode, setAuthMode] = useState<AuthMode>('LOGIN');
  const [authStage, setAuthStage] = useState<AuthStage>('FORM');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [insights, setInsights] = useState<NewsInsight[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [showLangSelector, setShowLangSelector] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState('Initializing Node...');
  const [audioPlaying, setAudioPlaying] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const startAnalysis = async (profile: Partial<UserProfile>) => {
    setAuthStage('ANALYZING');
    setAnalysisStatus('Decrypting user signals...');
    try {
      // Analyze interests using Gemini to personalize the feed immediately
      const interests = await analyzeUserInterests(profile.email || 'guest', profile.username || 'User');
      const finalProfile: UserProfile = {
        username: profile.username || profile.email?.split('@')[0] || 'User',
        email: profile.email,
        authMethod: profile.authMethod!,
        interests,
        lastAnalysis: new Date().toISOString()
      };
      setUserProfile(finalProfile);
      localStorage.setItem('shortz_profile', JSON.stringify(finalProfile));
      setAuthStage('COMPLETED');
    } catch (e) {
      setAuthError('Analysis failed. Please try again.');
      setAuthStage('FORM');
    }
  };

  const handleEmailAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!email.includes('@') || password.length < 6) {
      setAuthError('Please enter a valid email and 6+ character password.');
      return;
    }

    if (authMode === 'SIGNUP' && !username) {
      setAuthError('Username is required for new accounts.');
      return;
    }

    // Simulate verification delay
    setAuthStage('ANALYZING');
    setAnalysisStatus('Verifying credentials...');
    
    setTimeout(() => {
      startAnalysis({ 
        email, 
        username: authMode === 'SIGNUP' ? username : email.split('@')[0], 
        authMethod: 'email' 
      });
    }, 1500);
  };

  const handleGoogleLogin = () => {
    setAuthStage('ANALYZING');
    setAnalysisStatus('Connecting to Google Auth...');
    
    // Simulate OAuth flow
    setTimeout(() => {
      startAnalysis({ 
        email: 'google.user@gmail.com', 
        username: 'GoogleUser', 
        authMethod: 'google' 
      });
    }, 2000);
  };

  const fetchData = useCallback(async (query: string = "Latest global intelligence", append = false) => {
    if (append) setLoadingMore(true);
    else { setLoading(true); setError(null); }
    try {
      // Pass user interests to Gemini to get a more relevant initial feed
      const enhancedQuery = userProfile?.interests.length 
        ? `${query} focusing on ${userProfile.interests.slice(0, 3).join(', ')}` 
        : query;
        
      const response = await fetchNewsFromAI(enhancedQuery);
      setArticles(prev => append ? [...prev, ...response.articles] : response.articles);
      setInsights(response.insights);
    } catch (err) {
      setError("Intelligence Link Failed.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [userProfile]);

  useEffect(() => { 
    if (userProfile && authStage === 'COMPLETED') {
      fetchData();
    } else if (userProfile) {
      // If profile exists from localstorage but not in current session flow
      fetchData();
    }
  }, [userProfile, fetchData, authStage]);

  const handlePlayAudio = useCallback(async (article: NewsArticle, text: string, lang: string) => {
    if (audioPlaying === article.id) {
      audioSourceRef.current?.stop();
      setAudioPlaying(null);
      return;
    }
    try {
      setAudioPlaying(article.id);
      const bytes = await generateNewsAudio(text, lang);
      if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const buffer = await decodeAudioData(bytes, audioContextRef.current, 24000, 1);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => setAudioPlaying(null);
      audioSourceRef.current = source;
      source.start(0);
    } catch { setAudioPlaying(null); }
  }, [audioPlaying]);

  const handleLogout = () => {
    localStorage.removeItem('shortz_profile');
    setUserProfile(null);
    setAuthStage('FORM');
    setEmail('');
    setPassword('');
  };

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 sm:p-12 overflow-hidden relative">
        {/* Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-10 left-10 w-64 h-64 bg-blue-400 rounded-full blur-[100px]" />
          <div className="absolute bottom-10 right-10 w-64 h-64 bg-emerald-400 rounded-full blur-[100px]" />
        </div>

        <div className="w-full max-w-lg space-y-10 relative z-10">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-blue-500/30 mx-auto mb-6 animate-pulse">
               <Icons.Pulse />
            </div>
            <h1 className="text-4xl font-black tracking-tighter uppercase font-heading text-slate-900">Shortz AI</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Intelligence Studio</p>
          </div>

          <div className="bg-white border border-slate-100 p-8 sm:p-12 rounded-[3rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)]">
            {authStage === 'FORM' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="flex bg-slate-50 p-1.5 rounded-2xl">
                  <button 
                    onClick={() => setAuthMode('LOGIN')}
                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${authMode === 'LOGIN' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                  >
                    Login
                  </button>
                  <button 
                    onClick={() => setAuthMode('SIGNUP')}
                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${authMode === 'SIGNUP' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                  >
                    Register
                  </button>
                </div>

                <form onSubmit={handleEmailAuth} className="space-y-5">
                  {authMode === 'SIGNUP' && (
                    <input 
                      type="text" 
                      placeholder="Username" 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/5 transition-all"
                    />
                  )}
                  <input 
                    type="email" 
                    placeholder="Email Address" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/5 transition-all"
                  />
                  <input 
                    type="password" 
                    placeholder="Password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/5 transition-all"
                  />
                  
                  {authError && <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest text-center">{authError}</p>}

                  <button type="submit" className="w-full bg-slate-900 text-white rounded-2xl py-4 font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl active:scale-95">
                    {authMode === 'LOGIN' ? 'Continue' : 'Create Account'}
                  </button>
                </form>

                <div className="relative flex items-center justify-center">
                  <div className="absolute w-full border-t border-slate-100"></div>
                  <span className="relative bg-white px-4 text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">OR</span>
                </div>

                <button 
                  onClick={handleGoogleLogin}
                  className="w-full bg-white border-2 border-slate-100 text-slate-900 rounded-2xl py-4 font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-3 active:scale-95"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google Login
                </button>
              </div>
            )}

            {authStage === 'ANALYZING' && (
              <div className="text-center py-10 space-y-8 animate-pulse">
                <div className="w-16 h-16 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin mx-auto" />
                <div className="space-y-2">
                  <p className="text-[11px] font-black uppercase text-blue-600 tracking-widest">{analysisStatus}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">Syncing with Gemini Network</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-20 sm:pb-0">
      <header className="sticky top-0 z-[60] glass-header px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => fetchData()}>
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
             <Icons.Pulse />
          </div>
          <h1 className="text-xl font-black tracking-tighter font-heading text-slate-900">SHORTZ STUDIO</h1>
        </div>
        <div className="flex items-center gap-4">
           <button onClick={() => setShowLangSelector(true)} className="p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors">
             <Icons.Translate />
           </button>
           <div className="group relative">
             <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white font-black cursor-pointer ring-offset-2 ring-blue-500 group-hover:ring-2 transition-all">
               {userProfile.username.charAt(0).toUpperCase()}
             </div>
             <div className="absolute right-0 top-full mt-3 hidden group-hover:block w-48 bg-white border border-slate-100 rounded-2xl p-2 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="p-3 mb-2 border-b border-slate-50">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-900 truncate">{userProfile.username}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase truncate">{userProfile.email}</p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 text-[10px] font-black text-rose-500 uppercase tracking-widest hover:bg-rose-50 rounded-xl transition-colors"
                >
                  Log Out
                </button>
             </div>
           </div>
        </div>
      </header>

      {showLangSelector && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div className="bg-white w-full max-w-lg rounded-t-[3rem] sm:rounded-[3rem] p-10 space-y-8 animate-in slide-in-from-bottom-20 duration-500">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black uppercase tracking-widest">Global Output</h3>
              <button onClick={() => setShowLangSelector(false)} className="w-10 h-10 flex items-center justify-center bg-slate-50 rounded-full text-slate-400 hover:text-slate-900">×</button>
            </div>
            <div className="grid grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto no-scrollbar pr-2">
              {LANGUAGES.map(lang => (
                <button 
                  key={lang}
                  onClick={() => { setSelectedLanguage(lang); setShowLangSelector(false); }}
                  className={`py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all ${selectedLanguage === lang ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : 'bg-slate-50 hover:bg-slate-100'}`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 py-12 space-y-16">
        <section className="space-y-8 text-center sm:text-left">
          <div className="space-y-2">
            <h2 className="text-5xl sm:text-7xl font-black font-heading tracking-tight text-slate-900 leading-[0.9]">Intelligence Network</h2>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.3em]">Real-time grounding via Google Search</p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); fetchData(searchQuery); }} className="relative group max-w-4xl mx-auto sm:mx-0">
            <input 
              type="text" 
              placeholder="Query global signals..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-[2.5rem] py-8 px-12 text-2xl font-black focus:outline-none focus:ring-8 focus:ring-blue-500/5 transition-all shadow-2xl shadow-slate-200"
            />
            <button type="submit" className="absolute right-6 top-1/2 -translate-y-1/2 w-16 h-16 bg-slate-900 text-white rounded-3xl flex items-center justify-center hover:bg-blue-600 transition-all active:scale-95 shadow-xl">
              <Icons.Search />
            </button>
          </form>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <aside className="lg:col-span-4 space-y-12">
            <div className="bg-white border border-slate-100 rounded-[3rem] p-10 shadow-sm min-h-[400px] sticky top-24">
               <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-10 border-b border-slate-50 pb-4">Trending Signals</h3>
               <TrendingChart insights={insights} />
               <div className="mt-10 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black uppercase text-slate-900 mb-2">Personalized For You</p>
                  <div className="flex flex-wrap gap-2">
                    {userProfile.interests.map((int, i) => (
                      <span key={i} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-bold text-blue-600 uppercase">{int}</span>
                    ))}
                  </div>
               </div>
            </div>
          </aside>
          
          <div className="lg:col-span-8 space-y-10">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {[1,2,3,4].map(i => <div key={i} className="h-[500px] bg-slate-50 rounded-[3rem] animate-pulse" />)}
              </div>
            ) : error ? (
              <div className="text-center py-32 bg-rose-50 rounded-[4rem] border border-rose-100">
                <p className="text-2xl font-black text-rose-900 mb-6 uppercase tracking-tighter">{error}</p>
                <button onClick={() => fetchData()} className="px-12 py-5 bg-rose-600 text-white rounded-2xl font-black uppercase shadow-xl shadow-rose-200 active:scale-95 transition-all">Retry Link</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {articles.map(article => (
                  <NewsCard 
                    key={article.id}
                    article={article}
                    onPlayAudio={handlePlayAudio}
                    isPlaying={audioPlaying === article.id}
                    onLike={() => {}}
                    onBookmark={() => {}}
                    globalLanguage={selectedLanguage}
                    username={userProfile.username}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <LiveAnchor />

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-24 bg-white/80 backdrop-blur-2xl border-t border-slate-100 flex items-center justify-around px-8 sm:hidden z-50">
         <button onClick={() => fetchData()} className="p-4 text-slate-900 hover:bg-slate-50 rounded-2xl transition-all active:scale-90"><Icons.Pulse /></button>
         <button onClick={() => fetchData("top insights")} className="p-4 text-slate-400 hover:bg-slate-50 rounded-2xl transition-all active:scale-90"><Icons.Impact /></button>
         <button onClick={() => setShowLangSelector(true)} className="p-4 text-slate-400 hover:bg-slate-50 rounded-2xl transition-all active:scale-90"><Icons.Translate /></button>
         <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-900 font-black text-[10px]">{userProfile.username.charAt(0).toUpperCase()}</div>
      </nav>
    </div>
  );
};

export default App;
