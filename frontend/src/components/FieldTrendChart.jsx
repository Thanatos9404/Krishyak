import React from 'react';
import { Line, LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function FieldTrendChart({ observations, index, description }) {
  const values = observations.map(item => ({ date: item.start.slice(0,10), value: item.mean }));
  return <figure aria-label={description}><figcaption>{description} ({index.toUpperCase()})</figcaption>
    <div style={{ width: '100%', height: 220 }} aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><LineChart data={values}>
      <XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis domain={[-1, 1]} width={32} /><Tooltip />
      <Line dataKey="value" stroke="#287454" strokeWidth={2} connectNulls={false} isAnimationActive={false} />
    </LineChart></ResponsiveContainer></div>
    <details><summary>{description}</summary><ul>{values.map(item => <li key={item.date}>{item.date}: {item.value == null ? '—' : item.value.toFixed(3)}</li>)}</ul></details>
  </figure>;
}
