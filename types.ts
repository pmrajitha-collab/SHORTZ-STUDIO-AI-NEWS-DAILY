
export interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
}

export interface UserProfile {
  username: string;
  email?: string;
  authMethod: 'google' | 'email' | 'guest';
  interests: string[];
  lastAnalysis?: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  category: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  publishedAt: string;
  source: string;
  sourceUrl: string;
  imageUrls: string[]; 
  bullets: string[];
  readingTime: number;
  liked?: boolean;
  bookmarked?: boolean;
  comments?: Comment[];
  // Advanced Intel Fields
  impactScore: number; // 0-100
  futureForecast: string;
  groundingUrls?: { title: string; uri: string }[];
}

export interface NewsInsight {
  topic: string;
  volume: number;
  sentimentScore: number;
  trend: 'up' | 'down' | 'stable';
}