
import React, { useState, memo, useEffect, useRef } from 'react';
import { NewsArticle, Comment } from '../types';
import { Icons } from '../constants';
import { generateSmartImage, translateContent } from '../services/geminiService';

interface NewsCardProps {
  article: NewsArticle;
  onPlayAudio: (article: NewsArticle, text: string, lang: string) => void;
  isPlaying: boolean;
  onLike: (id: string) => void;
  onBookmark: (id: string) => void;
  globalLanguage: string;
  username: string;
}

const NewsCard: React.FC<NewsCardProps> = memo(({ article, onPlayAudio, isPlaying, onLike, onBookmark, globalLanguage, username }) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'impact' | 'comments'>('summary');
  const [showHeart, setShowHeart] = useState(false);
  const [aiImage, setAiImage] = useState<string | null>(null);
  const [translatedTitle, setTranslatedTitle] = useState(article.title);
  const [translatedSummary, setTranslatedSummary] = useState(article.summary);
  const [isTranslating, setIsTranslating] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);

  // Load comments from local storage
  useEffect(() => {
    const savedComments = localStorage.getItem(`shortz_comments_${article.id}`);
    if (savedComments) {
      setComments(JSON.parse(savedComments));
    }
  }, [article.id]);

  useEffect(() => {
    if (article.imageUrls[0].includes('unsplash') && !aiImage) {
      generateSmartImage(article.title).then(url => {
        if (url) setAiImage(url);
      });
    }
  }, [article.title, article.imageUrls, aiImage]);

  useEffect(() => {
    if (globalLanguage !== 'English') {
      setIsTranslating(true);
      const translate = async () => {
        try {
          const [tTitle, tSummary] = await Promise.all([
            translateContent(article.title, globalLanguage),
            translateContent(article.summary, globalLanguage)
          ]);
          setTranslatedTitle(tTitle);
          setTranslatedSummary(tSummary);
        } catch (err) {
          console.error("Translation fail", err);
        } finally {
          setIsTranslating(false);
        }
      };
      translate();
    } else {
      setTranslatedTitle(article.title);
      setTranslatedSummary(article.summary);
    }
  }, [globalLanguage, article.title, article.summary]);

  const handleDoubleClick = () => {
    onLike(article.id);
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 800);
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;

    // FIX: Renamed 'new Comment' to 'newComment' to avoid reserved keyword and type collision
    const newComment: Comment = {
      id: Math.random().toString(36).substring(2, 11),
      author: username,
      text: commentInput,
      timestamp: new Date().toISOString()
    };

    const updatedComments = [newComment, ...comments];
    setComments(updatedComments);
    localStorage.setItem(`shortz_comments_${article.id}`, JSON.stringify(updatedComments));
    setCommentInput('');
  };

  const handleShare = async () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 1080;
    canvas.height = 1080;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Image
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = aiImage || article.imageUrls[0];
    
    await new Promise((res) => {
      img.onload = () => {
        const aspect = img.width / img.height;
        let w = canvas.width;
        let h = canvas.width / aspect;
        if (h < 600) { h = 600; w = 600 * aspect; }
        ctx.drawImage(img, (canvas.width - w) / 2, 0, w, h);
        res(null);
      };
      img.onerror = () => res(null);
    });

    // Gradient Overlay
    const gradient = ctx.createLinearGradient(0, 400, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.4, 'rgba(255,255,255,0.95)');
    gradient.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 400, canvas.width, canvas.height - 400);

    // Text
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 64px Space Grotesk, sans-serif';
    const words = translatedTitle.split(' ');
    let line = '';
    let y = 700;
    for (const word of words) {
      const testLine = line + word + ' ';
      if (ctx.measureText(testLine).width > 900) {
        ctx.fillText(line, 80, y);
        line = word + ' ';
        y += 80;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 80, y);

    // Summary
    ctx.fillStyle = '#64748b';
    ctx.font = '500 32px Inter, sans-serif';
    ctx.fillText(translatedSummary.slice(0, 150) + '...', 80, y + 100);

    // Watermark
    ctx.fillStyle = '#2563eb';
    ctx.font = '900 40px Space Grotesk, sans-serif';
    ctx.fillText('SHORTZ STUDIO AI', 80, 1000);

    const dataUrl = canvas.toDataURL('image/png');
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], 'news.png', { type: 'image/png' });

    if (navigator.share) {
      try {
        await navigator.share({
          files: [file],
          title: translatedTitle,
          text: `Check out this news from Shortz AI Studio in ${globalLanguage}!`,
        });
      } catch (e) {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'shortz-news.png';
        link.click();
      }
    } else {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = 'shortz-news.png';
      link.click();
    }
  };

  const sentimentColor = 
    article.sentiment === 'positive' ? 'text-emerald-600 bg-emerald-50' :
    article.sentiment === 'negative' ? 'text-rose-600 bg-rose-50' :
    'text-blue-600 bg-blue-50';

  return (
    <div 
      ref={cardRef}
      onDoubleClick={handleDoubleClick}
      className="group relative bg-white border border-slate-100 rounded-[2rem] overflow-hidden hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.08)] transition-all duration-500 flex flex-col h-full"
    >
      {showHeart && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <Icons.Heart fill="#ef4444" className="w-24 h-24 text-rose-500 animate-ping" />
        </div>
      )}

      {/* Image Section */}
      <div className="relative h-60 overflow-hidden bg-slate-100">
        <img 
          src={aiImage || article.imageUrls[0]} 
          alt={article.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        
        <div className="absolute top-5 left-5 flex gap-2">
          <span className="px-3 py-1 bg-white/90 backdrop-blur-md rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-900 shadow-sm border border-white">
            {article.category}
          </span>
          {article.sentiment !== 'neutral' && (
            <div className={`px-3 py-1 rounded-lg backdrop-blur-md border border-white/20 flex items-center gap-1.5 ${sentimentColor} shadow-sm`}>
               <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
               <span className="text-[10px] font-black uppercase tracking-widest">{article.sentiment}</span>
            </div>
          )}
        </div>

        <div className="absolute bottom-5 right-5 flex gap-2">
           <button 
            onClick={handleShare}
            className="p-4 rounded-2xl bg-white/90 backdrop-blur-md text-slate-900 hover:bg-white transition-all transform hover:scale-110 active:scale-95 shadow-xl"
            title="Share with watermark"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
          <button 
            onClick={() => onPlayAudio(article, translatedSummary, globalLanguage)}
            className={`p-4 rounded-2xl transition-all transform hover:scale-110 active:scale-95 shadow-xl ${isPlaying ? 'bg-blue-600 text-white shadow-blue-500/30' : 'bg-white text-slate-900 hover:bg-slate-50'}`}
          >
            {isPlaying ? (
              <div className="flex gap-1 items-center h-5">
                {[1,2,3].map(i => <div key={i} className={`w-1 bg-current animate-bounce`} style={{ animationDelay: `${i*150}ms`, height: `${i*4+6}px` }} />)}
              </div>
            ) : <Icons.Audio />}
          </button>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-8 flex flex-col flex-grow">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-100">
              {article.source.charAt(0)}
             </div>
             <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{article.source}</span>
          </div>
          <button onClick={() => onBookmark(article.id)} className={`p-2 transition-all ${article.bookmarked ? 'text-blue-600' : 'text-slate-300 hover:text-slate-900'}`}>
            <Icons.Bookmark fill={article.bookmarked ? "currentColor" : "none"} />
          </button>
        </div>

        <h3 className={`text-xl font-black font-heading leading-tight mb-5 text-slate-900 group-hover:text-blue-600 transition-all ${isTranslating ? 'blur-sm opacity-50' : ''}`}>
          {translatedTitle}
        </h3>

        {/* Tab System */}
        <div className="flex gap-4 border-b border-slate-50 mb-6 overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setActiveTab('summary')}
            className={`pb-3 text-[10px] font-black uppercase tracking-widest transition-all relative shrink-0 ${activeTab === 'summary' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Summary
            {activeTab === 'summary' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
          </button>
          <button 
            onClick={() => setActiveTab('impact')}
            className={`pb-3 text-[10px] font-black uppercase tracking-widest transition-all relative shrink-0 ${activeTab === 'impact' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Future Impact
            {activeTab === 'impact' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600" />}
          </button>
          <button 
            onClick={() => setActiveTab('comments')}
            className={`pb-3 text-[10px] font-black uppercase tracking-widest transition-all relative shrink-0 ${activeTab === 'comments' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Comments ({comments.length})
            {activeTab === 'comments' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />}
          </button>
        </div>

        <div className="flex-grow">
          {activeTab === 'summary' && (
            <div className={`animate-in fade-in duration-300 ${isTranslating ? 'blur-sm opacity-50' : ''}`}>
              <p className="text-[13px] text-slate-500 leading-relaxed mb-6 font-medium italic">"{translatedSummary}"</p>
              <div className="space-y-3">
                {article.bullets.slice(0, 3).map((b, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="w-1 h-1 rounded-full bg-blue-600 mt-2 shrink-0" />
                    <p className="text-[11px] font-semibold text-slate-600 tracking-tight leading-snug">{b}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {activeTab === 'impact' && (
            <div className="animate-in fade-in duration-300 space-y-6">
              <div className="bg-slate-50 p-4 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                   <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Market Significance</span>
                   <span className="text-[11px] font-black text-emerald-600">{article.impactScore}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${article.impactScore}%` }} />
                </div>
              </div>
              <div className="flex gap-3">
                <Icons.Forecast className="shrink-0 text-emerald-600" />
                <p className="text-[12px] font-bold text-slate-700 leading-relaxed uppercase tracking-tight">
                  {article.futureForecast}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="animate-in fade-in duration-300 h-full flex flex-col">
              <form onSubmit={handleAddComment} className="mb-6">
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Add to the conversation..." 
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-[12px] font-medium focus:outline-none focus:ring-2 focus:ring-slate-100 transition-all pr-12"
                  />
                  <button 
                    type="submit" 
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </form>
              
              <div className="space-y-4 max-h-48 overflow-y-auto no-scrollbar">
                {comments.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic text-center py-4">No comments yet. Be the first to analyze.</p>
                ) : (
                  comments.map(comment => (
                    <div key={comment.id} className="bg-slate-50/50 p-3 rounded-xl border border-slate-50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">{comment.author}</span>
                        <span className="text-[8px] font-bold text-slate-300 uppercase">{new Date(comment.timestamp).toLocaleDateString()}</span>
                      </div>
                      <p className="text-[11px] font-medium text-slate-600 leading-snug">{comment.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
          <div className="flex gap-2">
            {article.groundingUrls?.map((u, i) => (
              <a key={i} href={u.uri} target="_blank" rel="noopener" title={u.title} className="p-2 bg-slate-50 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
                <Icons.External />
              </a>
            ))}
          </div>
          <span className="text-[9px] font-mono text-slate-300 uppercase tracking-widest">{article.id.slice(0, 8)}</span>
        </div>
      </div>
    </div>
  );
});

export default NewsCard;
