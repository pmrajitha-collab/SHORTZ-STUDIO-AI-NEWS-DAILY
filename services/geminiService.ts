
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { NewsArticle, NewsInsight } from "../types";

const newsCache: Record<string, { data: { articles: NewsArticle[], insights: NewsInsight[] }, timestamp: number }> = {};
const CACHE_TTL = 1000 * 60 * 5; 

// Circuit breaker for image generation to handle quota limits
let isImageQuotaExhausted = false;
let quotaResetTimeout: number | null = null;

export const decode = (base64: string) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const encode = (bytes: Uint8Array) => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const normalizeArticles = (articles: any[], groundingMetadata?: any): NewsArticle[] => {
  const urls = groundingMetadata?.groundingChunks?.map((c: any) => ({
    title: c.web?.title || 'Source',
    uri: c.web?.uri || '#'
  })) || [];

  return (Array.isArray(articles) ? articles : []).map(a => {
    const id = a?.id || Math.random().toString(36).substring(2, 11);
    return {
      id,
      title: a?.title || "Intelligence Update",
      summary: a?.summary || "Connecting with global network nodes...",
      category: a?.category || "Global",
      sentiment: (a?.sentiment === 'positive' || a?.sentiment === 'negative' || a?.sentiment === 'neutral') ? a.sentiment : 'neutral',
      publishedAt: a?.publishedAt || new Date().toISOString(),
      source: a?.source || "Intelligence Hub",
      sourceUrl: a?.sourceUrl || "https://google.com/news",
      imageUrls: Array.isArray(a?.imageUrls) && a.imageUrls.length > 0 
        ? a.imageUrls 
        : [`https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1200&sig=${id}`],
      bullets: Array.isArray(a?.bullets) ? a.bullets : ["Processing intel..."],
      readingTime: a?.readingTime || 2,
      impactScore: a?.impactScore || Math.floor(Math.random() * 40) + 60,
      futureForecast: a?.futureForecast || "Analyzing long-term market trajectories...",
      groundingUrls: urls.slice(0, 3)
    };
  });
};

export const fetchNewsFromAI = async (
  query: string = "Breaking global news", 
  excludedIds: string[] = []
): Promise<{articles: NewsArticle[], insights: NewsInsight[]}> => {
  const cacheKey = `${query}-${excludedIds.length}`;
  const now = Date.now();

  if (newsCache[cacheKey] && (now - newsCache[cacheKey].timestamp) < CACHE_TTL) {
    return newsCache[cacheKey].data;
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const systemInstruction = `You are a high-level intelligence analyst. Output JSON ONLY. 
  Required JSON structure: { "articles": [{ "id", "title", "summary", "bullets": [], "source", "category", "sentiment", "impactScore": number, "futureForecast": string }], "insights": [{ "topic", "volume", "sentimentScore", "trend": "up"|"down" }] }.
  Use the search tool for real-time accuracy. Focus on High-impact global events. If the query mentions specific user interests, prioritize them heavily.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Intelligence Request: ${query}. Use Search. Ground the response in real facts.`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }]
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    const result = {
      articles: normalizeArticles(parsed.articles, response.candidates?.[0]?.groundingMetadata).filter(a => !excludedIds.includes(a.id)),
      insights: Array.isArray(parsed.insights) ? parsed.insights : []
    };

    newsCache[cacheKey] = { data: result, timestamp: now };
    return result;
  } catch (error) {
    console.error("AI Update Error:", error);
    return { articles: [], insights: [] };
  }
};

export const analyzeUserInterests = async (email: string, username: string): Promise<string[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Simulate an analysis of the Google News feed and search history for the user: ${username} (${email}). 
      Based on current global trends and the likely profile of an advanced tech enthusiast, return a JSON list of 6-8 trending topics they are likely interested in.
      Output JSON ONLY: ["Topic 1", "Topic 2", ...]`,
      config: {
        responseMimeType: "application/json",
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Interest Analysis Error:", e);
    return ["Artificial Intelligence", "Quantum Computing", "Space Exploration", "Global Finance"];
  }
};

export const translateContent = async (text: string, targetLanguage: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Translate the following text strictly into ${targetLanguage}. Maintain the tone and context. Do not include any notes or explanations. Text: ${text}`,
    });
    return response.text || text;
  } catch (e) {
    console.error("Translation Error:", e);
    return text;
  }
};

export const generateSmartImage = async (prompt: string): Promise<string | null> => {
  if (isImageQuotaExhausted) return null;

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: `A high-quality, photorealistic editorial news photograph for a story titled: "${prompt}". Professional documentary photography, sharp focus, real-world setting.` }] },
      config: { imageConfig: { aspectRatio: "16:9" } }
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
  } catch (e: any) {
    if (e?.message?.includes('429') || e?.message?.includes('RESOURCE_EXHAUSTED')) {
      console.warn("AI Image Generation quota exhausted. Falling back to high-quality placeholders.");
      isImageQuotaExhausted = true;
      if (quotaResetTimeout) window.clearTimeout(quotaResetTimeout);
      quotaResetTimeout = window.setTimeout(() => {
        isImageQuotaExhausted = false;
      }, 120000);
    } else {
      console.error("Image Gen Error:", e);
    }
  }
  return null;
};

export const generateNewsAudio = async (text: string, language: string = "English"): Promise<Uint8Array> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Narrate clearly in ${language}: ${text}` }] }],
    config: {
      responseModalalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
    },
  });
  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
  return decode(base64Audio);
};
