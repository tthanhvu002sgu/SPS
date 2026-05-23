import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Brain, Frown, Sparkles, Smile, Coffee, Volume2 } from 'lucide-react';
import { processReview } from '../utils/srs';
import Dashboard from './Dashboard';

const StudySession = ({ words, settings, onUpdateWord, recordReview, streak, reviewHistory, isActive }) => {
  const [queue, setQueue] = useState([]);
  const [currentWord, setCurrentWord] = useState(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [practiceMode, setPracticeMode] = useState(false);
  const [isStudying, setIsStudying] = useState(false);
  const [randomFrontBack, setRandomFrontBack] = useState(false);
  const [showReverse, setShowReverse] = useState(false);

  // Set random orientation when currentWord changes
  useEffect(() => {
    if (currentWord && randomFrontBack) {
      setShowReverse(Math.random() < 0.5);
    } else {
      setShowReverse(false);
    }
  }, [currentWord, randomFrontBack]);

  // Initialize queue when isStudying becomes true or practiceMode/words changes
  useEffect(() => {
    if (!isStudying) return;

    if (practiceMode) {
      // In practice mode, queue all words
      const shuffled = [...words].sort(() => 0.5 - Math.random());
      setQueue(shuffled);
      if (shuffled.length > 0) {
        setCurrentWord(shuffled[0]);
        setSessionComplete(false);
      } else {
        setSessionComplete(true);
      }
      return;
    }

    const today = new Date().setHours(0,0,0,0);
    const reviewedCount = words.filter(w => w.isReviewedToday).length;
    
    // Total allowed to review today
    const remainingQuota = Math.max(0, settings.dailyLimit - reviewedCount);
    
    // Find due words
    let dueWords = words.filter(w => w.nextReviewDate <= today && !w.isReviewedToday);
    
    // Sort by nextReviewDate (oldest first)
    dueWords.sort((a, b) => a.nextReviewDate - b.nextReviewDate);
    
    // Apply limit
    dueWords = dueWords.slice(0, remainingQuota);

    setQueue(dueWords);
    if (dueWords.length > 0) {
      setCurrentWord(dueWords[0]);
      setSessionComplete(false);
    } else {
      setSessionComplete(true);
    }
  }, [isStudying, words, settings.dailyLimit, practiceMode]);

  const handleExitSession = () => {
    setIsStudying(false);
    setSessionComplete(false);
    setCurrentWord(null);
    setQueue([]);
  };

  const handleFlip = () => {
    setIsFlipped(true);
  };

  const handleGrade = (grade) => {
    if (!practiceMode) {
      const updatedWord = processReview(currentWord, grade, settings.intervalMultiplier || 1);
      onUpdateWord(updatedWord);
    }
    
    if (recordReview) {
      recordReview(currentWord.id, grade);
    }
    
    setIsFlipped(false);
    
    const newQueue = queue.slice(1);
    setQueue(newQueue);
    
    if (newQueue.length > 0) {
      setTimeout(() => {
        setCurrentWord(newQueue[0]);
      }, 150);
    } else {
      setSessionComplete(true);
    }
  };

  const speakWord = React.useCallback((text, e) => {
    if (e) e.stopPropagation(); // prevent flipping the card when clicking the speaker icon
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      
      if (settings.voiceURI) {
        const voices = window.speechSynthesis.getVoices();
        const selectedVoice = voices.find(v => v.voiceURI === settings.voiceURI);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
      } else {
        utterance.lang = 'en-US';
      }
      
      // slightly slower for clarity
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  }, [settings.voiceURI]);

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (sessionComplete || !currentWord) return;

      if (e.key === 'Control') {
        if (!showReverse || isFlipped) {
          speakWord(currentWord.word);
        }
        return;
      }

      if (!isFlipped) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleFlip();
        }
      } else {
        if (e.key === '1') {
          e.preventDefault();
          handleGrade(0);
        } else if (e.key === '2') {
          e.preventDefault();
          handleGrade(3);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, isFlipped, sessionComplete, currentWord, queue, practiceMode, settings, handleGrade, speakWord, showReverse]);

  useEffect(() => {
    if (isActive && currentWord && !sessionComplete && !showReverse) {
      speakWord(currentWord.word);
    }
  }, [isActive, currentWord, sessionComplete, speakWord, showReverse]);

  useEffect(() => {
    if (isActive && currentWord && !sessionComplete && showReverse && isFlipped) {
      speakWord(currentWord.word);
    }
  }, [isActive, currentWord, sessionComplete, showReverse, isFlipped, speakWord]);

  if (!isStudying) {
    const today = new Date().setHours(0,0,0,0);
    const reviewedCount = words.filter(w => w.isReviewedToday).length;
    const remainingQuota = Math.max(0, settings.dailyLimit - reviewedCount);
    let dueWords = words.filter(w => w.nextReviewDate <= today && !w.isReviewedToday);
    const dueCount = Math.min(dueWords.length, remainingQuota);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', gap: '1rem', overflowY: 'auto', paddingBottom: '1.5rem' }}>
        {/* Full Dashboard Stats & Chart */}
        <Dashboard words={words} streak={streak} reviewHistory={reviewHistory} compact={false} />

        {/* Study Goal Card */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
              Mục tiêu học tập hôm nay
            </h3>
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>
              Hãy chọn chế độ học và bắt đầu ôn tập để duy trì streak của bạn nhé!
            </p>
          </div>

          {/* Mode Switcher Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: 'rgba(0,0,0,0.15)', padding: '0.25rem', borderRadius: '12px' }}>
            <button
              onClick={() => setPracticeMode(false)}
              style={{
                border: 'none',
                background: !practiceMode ? 'var(--glass-bg)' : 'transparent',
                color: !practiceMode ? 'var(--text-main)' : 'var(--text-muted)',
                padding: '0.6rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                transition: 'all 0.2s ease',
                boxShadow: !practiceMode ? '0 2px 8px rgba(0,0,0,0.2)' : 'none'
              }}
            >
              <span>○ SRS Mode (Hàng ngày)</span>
            </button>
            <button
              onClick={() => setPracticeMode(true)}
              style={{
                border: 'none',
                background: practiceMode ? 'var(--glass-bg)' : 'transparent',
                color: practiceMode ? 'var(--text-main)' : 'var(--text-muted)',
                padding: '0.6rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                transition: 'all 0.2s ease',
                boxShadow: practiceMode ? '0 2px 8px rgba(0,0,0,0.2)' : 'none'
              }}
            >
              <span>● Practice Mode (Tự do)</span>
            </button>
          </div>

          {/* Session Info & Summary */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', padding: '1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1))', color: 'var(--accent-primary)', padding: '0.75rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Brain size={24} />
            </div>
            <div style={{ flex: 1 }}>
              {!practiceMode ? (
                <>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                    {dueCount > 0 ? (
                      <>Hôm nay bạn có <span style={{ color: 'var(--accent-primary)', fontWeight: '800' }}>{dueCount}</span> từ cần ôn tập.</>
                    ) : (
                      <span style={{ color: 'var(--accent-success)' }}>Tuyệt vời! Bạn đã hoàn thành tất cả từ vựng hôm nay.</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    {dueCount > 0 ? "Từ vựng được lựa chọn dựa trên thuật toán lặp lại ngắt quãng (SRS)." : "Hãy chuyển sang Practice Mode để ôn luyện thêm."}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                    Luyện tập tự do với <span style={{ color: 'var(--accent-primary)', fontWeight: '800' }}>{words.length}</span> từ vựng hiện có.
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    Chế độ này không giới hạn số lượng và không ảnh hưởng đến lịch ôn tập SRS hàng ngày.
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Settings Options */}
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            padding: '0.75rem 1rem',
            borderRadius: '12px',
            border: '1px solid var(--glass-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            cursor: 'pointer',
            userSelect: 'none'
          }} onClick={() => setRandomFrontBack(prev => !prev)}>
            <input 
              type="checkbox" 
              checked={randomFrontBack} 
              onChange={(e) => {
                e.stopPropagation();
                setRandomFrontBack(e.target.checked);
              }}
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '4px',
                accentColor: 'var(--accent-primary)',
                cursor: 'pointer'
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                Xáo trộn mặt Thẻ (Mặt trước ↔ Mặt sau)
              </span>
              <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                Học ngẫu nhiên từ Anh ➔ Việt và Việt ➔ Anh để tăng độ nhớ từ vựng.
              </span>
            </div>
          </div>

          {/* Big CTA Start Button */}
          <button
            onClick={() => setIsStudying(true)}
            disabled={!practiceMode && dueCount === 0}
            className="btn btn-primary"
            style={{
              padding: '0.9rem',
              fontSize: '1rem',
              fontWeight: 700,
              letterSpacing: '0.5px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              background: (!practiceMode && dueCount === 0) ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              color: (!practiceMode && dueCount === 0) ? 'var(--text-muted)' : 'white',
              cursor: (!practiceMode && dueCount === 0) ? 'not-allowed' : 'pointer',
              border: 'none',
              boxShadow: (!practiceMode && dueCount === 0) ? 'none' : '0 4px 15px rgba(139, 92, 246, 0.3)',
              transition: 'all 0.2s ease'
            }}
          >
            BẮT ĐẦU HỌC
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', gap: '1rem', overflow: 'hidden' }}>
      {/* Active Session Header */}
      <div className="glass-panel" style={{ padding: '0.6rem 1rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <button
          onClick={handleExitSession}
          className="btn btn-outline"
          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', borderRadius: '8px' }}
        >
          <span>← Quay lại Dashboard</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            background: 'rgba(255,255,255,0.04)',
            padding: '0.25rem 0.6rem',
            borderRadius: '999px',
            border: '1px solid var(--glass-border)'
          }}>
            {practiceMode ? 'Practice Mode' : 'SRS Mode'}
          </span>
        </div>
      </div>

      {sessionComplete ? (
        <div className="glass-panel flex-center" style={{ flexDirection: 'column', textAlign: 'center', flex: 1, minHeight: 0 }}>
          <div style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--accent-success)', padding: '1.5rem', borderRadius: '50%', marginBottom: '1rem' }}>
            <Coffee size={48} />
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Tuyệt vời!</h2>
          <p className="text-muted" style={{ fontSize: '0.9rem', maxWidth: '380px', marginBottom: '1.5rem' }}>
            {practiceMode 
              ? "Bạn đã hoàn thành phiên luyện tập tự do!" 
              : "Bạn đã hoàn thành tất cả các từ cần ôn tập của hôm nay!"}
          </p>
          <button onClick={handleExitSession} className="btn btn-primary" style={{ padding: '0.6rem 1.5rem', borderRadius: '8px' }}>
            Về Dashboard
          </button>
        </div>
      ) : currentWord ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ background: 'var(--glass-bg)', padding: '0.3rem 1rem', borderRadius: '999px', border: '1px solid var(--glass-border)', fontSize: '0.85rem' }}>
            Còn lại: <strong className="text-gradient">{queue.length}</strong> từ
          </div>

          <div className="flashcard-container" onClick={!isFlipped ? handleFlip : undefined}>
            <div className={`flashcard ${isFlipped ? 'flipped' : ''}`}>
              {/* Front side of the card */}
              <div className="flashcard-front">
                <p className="text-muted" style={{ position: 'absolute', top: '1rem', textTransform: 'uppercase', letterSpacing: '2px', fontSize: '0.7rem' }}>Tap or Space to flip</p>
                
                {/* Active Mode Badge */}
                <div style={{
                  position: 'absolute',
                  top: '2.5rem',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: showReverse ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                  border: showReverse ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)',
                  color: showReverse ? 'var(--accent-warning)' : 'var(--accent-primary)',
                  padding: '0.2rem 0.75rem',
                  borderRadius: '999px',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap'
                }}>
                  {showReverse ? 'Đoán từ Tiếng Anh' : 'Đoán nghĩa Tiếng Việt'}
                </div>

                {!showReverse && (
                  <button 
                    onClick={(e) => speakWord(currentWord.word, e)} 
                    className="btn btn-outline" 
                    style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.4rem', borderRadius: '50%', border: 'none' }}
                    title="Listen"
                  >
                    <Volume2 size={20} className="text-muted" />
                  </button>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem', width: '100%' }}>
                  <h1 className="word-large text-gradient" style={{ marginBottom: 0, fontSize: showReverse ? '2rem' : '3rem', wordBreak: 'break-word', lineHeight: '1.2' }}>
                    {showReverse ? (currentWord.viMeaning || currentWord.meaning) : currentWord.word}
                  </h1>
                  {!showReverse && currentWord.phonetic && (
                    <p className="text-muted" style={{ fontSize: '1.2rem', fontFamily: 'monospace' }}>{currentWord.phonetic}</p>
                  )}
                </div>
              </div>
              
              {/* Back side of the card */}
              <div className="flashcard-back">
                {/* Active Mode Badge on Back */}
                <div style={{
                  position: 'absolute',
                  top: '1rem',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: 'var(--accent-success)',
                  padding: '0.15rem 0.6rem',
                  borderRadius: '999px',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  textTransform: 'uppercase'
                }}>
                  Đáp án
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', marginTop: '1.5rem' }}>
                  <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 0 }}>{currentWord.word}</h1>
                  <button onClick={(e) => speakWord(currentWord.word, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} title="Listen">
                    <Volume2 size={22} />
                  </button>
                </div>
                {currentWord.phonetic && <p className="text-muted" style={{ fontSize: '1.1rem', fontFamily: 'monospace', marginBottom: '0.5rem' }}>{currentWord.phonetic}</p>}
                <div style={{ width: '40px', height: '3px', background: 'var(--accent-primary)', margin: '0.5rem 0', borderRadius: '2px' }}></div>
                
                {currentWord.viMeaning && <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--accent-warning)', marginBottom: '0.25rem' }}>{currentWord.viMeaning}</p>}
                <p className="word-meaning">{currentWord.meaning}</p>
                {currentWord.example && <p className="word-example">"{currentWord.example}"</p>}
              </div>
            </div>
          </div>

          <AnimatePresence>
            {isFlipped && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{ display: 'flex', gap: '1rem' }}
              >
                <button onClick={() => handleGrade(0)} className="btn btn-outline" style={{ borderColor: 'var(--accent-danger)', color: 'var(--accent-danger)' }}>
                  <Frown size={18} /> Forget (1)
                </button>
                <button onClick={() => handleGrade(3)} className="btn btn-outline" style={{ borderColor: 'var(--accent-success)', color: 'var(--accent-success)' }}>
                  <Sparkles size={18} /> Easy (2)
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : null}
    </div>
  );
};



export default StudySession;
