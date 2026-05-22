import React, { useState } from 'react';
import { Flame } from 'lucide-react';

const Dashboard = ({ words = [], streak = 0, reviewHistory = {}, compact = false }) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Compute vocabulary stats
  const masteredCount = words.filter(w => w.repetition >= 3).length;
  const unstartedCount = words.filter(w => w.repetition === 0).length;

  // Helper to get start of current week (Sunday)
  const getStartOfWeek = (d) => {
    const date = new Date(d);
    const day = date.getDay(); // 0 = Sunday, 1 = Monday, ...
    const diff = date.getDate() - day;
    const sunday = new Date(date.setDate(diff));
    sunday.setHours(0, 0, 0, 0);
    return sunday;
  };

  const startOfWeek = getStartOfWeek(new Date());

  // Helper to format date as YYYY-MM-DD
  const formatDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const todayStr = formatDateStr(new Date());

  // Generate 7 days of the current week with their stats
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    const dateStr = formatDateStr(d);
    const data = reviewHistory[dateStr] || { total: 0, correct: 0 };
    const accuracy = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
    
    return {
      dayName: dayNames[i],
      dateStr,
      total: data.total,
      correct: data.correct,
      accuracy,
      isToday: todayStr === dateStr
    };
  });

  // Calculate current active day (hovered day, fallback to today)
  const today = new Date();
  const todayIndex = today.getDay(); // 0 = Sunday, 1 = Monday, ...
  const activeIndex = hoveredIndex !== null ? hoveredIndex : todayIndex;
  const activeData = chartData[activeIndex];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '0.6rem', flexShrink: 0 }}>
      {/* Top Row: 3 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
        {/* Streak Card */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.85rem 0.5rem', textAlign: 'center', borderRadius: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem' }}>
            <Flame size={20} color="#f97316" fill="#f97316" style={{ filter: 'drop-shadow(0 0 6px rgba(249, 115, 22, 0.5))' }} />
            <span style={{ fontSize: '1.4rem', fontWeight: '800', color: '#f97316', lineHeight: 1 }}>{streak}</span>
          </div>
          <span className="text-muted" style={{ fontSize: '0.72rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Streak</span>
        </div>

        {/* Thành thạo Card */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.85rem 0.5rem', textAlign: 'center', borderRadius: '16px' }}>
          <span style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--accent-secondary)', marginBottom: '0.2rem', lineHeight: 1, textShadow: '0 0 10px rgba(139, 92, 246, 0.4)' }}>{masteredCount}</span>
          <span className="text-muted" style={{ fontSize: '0.72rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Thành thạo</span>
        </div>

        {/* Chưa học Card */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.85rem 0.5rem', textAlign: 'center', borderRadius: '16px' }}>
          <span style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--accent-secondary)', marginBottom: '0.2rem', lineHeight: 1, textShadow: '0 0 10px rgba(139, 92, 246, 0.4)' }}>{unstartedCount}</span>
          <span className="text-muted" style={{ fontSize: '0.72rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Chưa học</span>
        </div>
      </div>

      {/* Bottom Card: Accuracy 7 ngày Chart */}
      <div className="glass-panel" style={{ padding: '1rem', borderRadius: '16px', display: 'flex', flexDirection: 'column' }}>
        {/* Chart Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)', margin: 0, textTransform: 'none', letterSpacing: 'normal' }}>
            Accuracy 7 ngày
          </h3>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', height: '2.2rem', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '500' }}>
              {activeData.total} reviews
            </span>
            <span style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--accent-secondary)', textShadow: '0 0 8px rgba(139, 92, 246, 0.3)' }}>
              {activeData.accuracy}%
            </span>
          </div>
        </div>

        {/* Bar Chart Area */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '80px', padding: '0 0.25rem' }}>
          {chartData.map((day, idx) => {
            const isActive = idx === activeIndex;
            const isHovered = idx === hoveredIndex;

            return (
              <div
                key={day.dayName}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flex: 1,
                  cursor: 'pointer',
                  transform: isHovered ? 'scale(1.05)' : 'none',
                  transition: 'transform 0.2s ease'
                }}
              >
                {/* Bar Track Container */}
                <div style={{
                  position: 'relative',
                  width: '28px',
                  height: '52px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '5px',
                  overflow: 'hidden',
                  marginBottom: '0.4rem',
                  border: day.isToday 
                    ? '1.5px solid rgba(139, 92, 246, 0.4)' 
                    : isHovered 
                      ? '1px solid rgba(255, 255, 255, 0.15)' 
                      : '1px solid transparent',
                  boxShadow: day.isToday ? '0 0 8px rgba(139, 92, 246, 0.15)' : 'none',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                }}>
                  {/* Actual Filled Bar */}
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    height: `${day.total > 0 ? Math.max(8, day.accuracy) : 4}%`,
                    background: day.total > 0
                      ? 'linear-gradient(to top, var(--accent-secondary), #a78bfa)'
                      : 'rgba(255, 255, 255, 0.08)',
                    borderRadius: '4px',
                    boxShadow: day.total > 0 && isActive ? '0 0 10px rgba(139, 92, 246, 0.5)' : 'none',
                    transition: 'height 0.6s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s ease'
                  }} />
                </div>

                {/* Day Label */}
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: isActive ? '700' : '500',
                  color: isActive ? 'var(--accent-secondary)' : 'var(--text-muted)',
                  transition: 'color 0.2s ease'
                }}>
                  {day.dayName}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
