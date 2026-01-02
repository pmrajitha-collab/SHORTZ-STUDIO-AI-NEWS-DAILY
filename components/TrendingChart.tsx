
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { NewsInsight } from '../types';

interface TrendingChartProps {
  insights: NewsInsight[];
}

const TrendingChart: React.FC<TrendingChartProps> = ({ insights }) => {
  const data = insights.map(i => ({
    name: i.topic,
    value: i.volume,
    sentiment: i.sentimentScore
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-xl text-[10px] font-bold uppercase tracking-wider">
          <p className="text-slate-900 mb-2">{label}</p>
          <div className="space-y-1">
            <p className="text-slate-400">Volume: <span className="text-blue-600">{payload[0].value}</span></p>
            <p className="text-slate-400">Signal: <span className={payload[0].payload.sentiment > 0 ? 'text-emerald-600' : 'text-rose-600'}>
              {(payload[0].payload.sentiment * 100).toFixed(0)}%
            </span></p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: -20, right: 30 }}>
          <XAxis type="number" hide />
          <YAxis 
            dataKey="name" 
            type="category" 
            stroke="#94a3b8" 
            fontSize={10} 
            width={90}
            tickLine={false}
            axisLine={false}
            fontWeight={700}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.sentiment > 0 ? '#10b981' : '#f43f5e'} 
                fillOpacity={0.5}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrendingChart;
