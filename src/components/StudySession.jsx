import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Brain, Frown, Sparkles, Smile, Coffee, Volume2 } from 'lucide-react';
import { processReview } from '../utils/srs';
import Dashboard from './Dashboard';

const StudySession = ({ words, settings, onUpdateWord, recordReview, streak, reviewHistory }) => {
  const [queue, setQueue] = useState([]);
  const [currentWord, setCurrentWord] = useState(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [practiceMode, setPracticeMode] = useState(false);

  useEffect(() => {
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
  }, [words, settings.dailyLimit, practiceMode]);

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
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (sessionComplete || !currentWord) return;

      if (e.key === 'Control') {
        speakWord(currentWord.word);
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
  }, [isFlipped, sessionComplete, currentWord, queue, practiceMode, settings, handleGrade, speakWord]);

  useEffect(() => {
    if (currentWord && !sessionComplete) {
      speakWord(currentWord.word);
    }
  }, [currentWord, sessionComplete, speakWord]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', gap: '0.75rem', overflow: 'hidden' }}>
      <Dashboard words={words} streak={streak} reviewHistory={reviewHistory} compact={true} />
      
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button 
          onClick={() => setPracticeMode(!practiceMode)}
          className={`btn ${practiceMode ? 'btn-primary' : 'btn-outline'}`}
        >
          {practiceMode ? '● Practice Mode (All Words)' : '○ SRS Mode (Due Words)'}
        </button>
      </div>

      {sessionComplete ? (
        <div className="glass-panel flex-center" style={{ flexDirection: 'column', textAlign: 'center', flex: 1, minHeight: 0 }}>
          <div style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--accent-success)', padding: '1.5rem', borderRadius: '50%', marginBottom: '1rem' }}>
            <Coffee size={48} />
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>All Done!</h2>
          <p className="text-muted" style={{ fontSize: '0.9rem', maxWidth: '380px' }}>
            {practiceMode 
              ? "You've practiced all your words! Great job." 
              : "All scheduled words reviewed. Come back later, or switch to Practice Mode."}
          </p>
        </div>
      ) : currentWord ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ background: 'var(--glass-bg)', padding: '0.3rem 1rem', borderRadius: '999px', border: '1px solid var(--glass-border)', fontSize: '0.85rem' }}>
            Remaining: <strong className="text-gradient">{queue.length}</strong>
          </div>

          <div className="flashcard-container" onClick={!isFlipped ? handleFlip : undefined}>
            <div className={`flashcard ${isFlipped ? 'flipped' : ''}`}>
              <div className="flashcard-front">
                <p className="text-muted" style={{ position: 'absolute', top: '1rem', textTransform: 'uppercase', letterSpacing: '2px', fontSize: '0.7rem' }}>Tap or Space to flip</p>
                
                <button 
                  onClick={(e) => speakWord(currentWord.word, e)} 
                  className="btn btn-outline" 
                  style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.4rem', borderRadius: '50%', border: 'none' }}
                  title="Listen"
                >
                  <Volume2 size={20} className="text-muted" />
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <h1 className="word-large text-gradient" style={{ marginBottom: 0 }}>{currentWord.word}</h1>
                  {currentWord.phonetic && <p className="text-muted" style={{ fontSize: '1.2rem', fontFamily: 'monospace' }}>{currentWord.phonetic}</p>}
                </div>
              </div>
              
              <div className="flashcard-back">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 0 }}>{currentWord.word}</h1>
                  <button onClick={(e) => speakWord(currentWord.word, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
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
