import React from 'react';
import { Book, CheckCircle, Clock } from 'lucide-react';

const StatCard = ({ title, value, icon, color, compact }) => (
  <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: compact ? '1rem' : '1.5rem', padding: compact ? '1rem' : '2rem' }}>
    <div 
      style={{ 
        background: `rgba(${color}, 0.1)`, 
        color: `rgb(${color})`, 
        padding: compact ? '0.75rem' : '1rem', 
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {React.cloneElement(icon, { size: compact ? 24 : 32 })}
    </div>
    <div>
      <p className="text-muted" style={{ fontSize: compact ? '0.75rem' : '0.875rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.25rem' }}>{title}</p>
      <h2 style={{ fontSize: compact ? '1.5rem' : '2.5rem', margin: 0 }}>{value}</h2>
    </div>
  </div>
);

const Dashboard = ({ words, compact = false }) => {
  const today = new Date().setHours(0,0,0,0);
  const totalWords = words.length;
  const toReview = words.filter(w => w.nextReviewDate <= today && !w.isReviewedToday).length;
  const reviewedToday = words.filter(w => w.isReviewedToday).length;

  return (
    <div style={{ flexShrink: 0 }}>
      <div className="grid-cards" style={compact ? { gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' } : {}}>
        <StatCard compact={compact} title="Total" value={totalWords} icon={<Book />} color="59, 130, 246" />
        <StatCard compact={compact} title="To Review" value={toReview} icon={<Clock />} color="245, 158, 11" />
        <StatCard compact={compact} title="Done Today" value={reviewedToday} icon={<CheckCircle />} color="16, 185, 129" />
      </div>
    </div>
  );
};

export default Dashboard;
