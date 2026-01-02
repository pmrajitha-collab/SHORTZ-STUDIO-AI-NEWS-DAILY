
import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { Icons } from '../constants';
import { decode, decodeAudioData, encode } from '../services/geminiService';

const LiveAnchor: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);

  const stopAnchor = useCallback(() => {
    setIsActive(false);
    streamRef.current?.getTracks().forEach(t => t.stop());
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
  }, []);

  const startAnchor = async () => {
    setIsConnecting(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }

    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsActive(true);
            const source = inputCtx.createMediaStreamSource(streamRef.current!);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              const input = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(input.length);
              for (let i = 0; i < input.length; i++) int16[i] = input[i] * 32768;
              sessionPromise.then(s => s.sendRealtimeInput({ 
                media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' }
              }));
            };
            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const base64 = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64) {
              const buffer = await decodeAudioData(decode(base64), audioContextRef.current!, 24000, 1);
              const source = audioContextRef.current!.createBufferSource();
              source.buffer = buffer;
              source.connect(audioContextRef.current!.destination);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContextRef.current!.currentTime);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => sourcesRef.current.delete(source);
            }
            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => stopAnchor(),
          onerror: () => stopAnchor()
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: 'You are the SHORTZ Studio Assistant. Provide sharp, intelligent analysis on news. Be concise and professional.'
        }
      });
    } catch (err) {
      console.error(err);
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-[100]">
      <div className={`flex items-center gap-4 p-3 bg-white border border-slate-200 rounded-3xl shadow-2xl transition-all duration-500 ${isActive ? 'pr-8 pl-4' : 'p-2'}`}>
        {isActive && (
          <div className="flex gap-1 h-8 items-center px-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="w-1 bg-blue-600 rounded-full animate-bounce" style={{ height: `${Math.random() * 20 + 8}px`, animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        )}
        
        <button 
          onClick={isActive ? stopAnchor : startAnchor}
          disabled={isConnecting}
          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isActive ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-blue-600 text-white shadow-xl shadow-blue-500/20 hover:scale-105 active:scale-95'}`}
        >
          {isConnecting ? <Icons.Loading /> : isActive ? <div className="w-4 h-4 bg-current rounded-sm" /> : <Icons.LiveAnchor />}
        </button>

        {isActive && (
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Assistant Active</span>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Live Conversation Mode</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveAnchor;
