import React, { useState } from 'react';
import { useVocab } from './hooks/useVocab';
import StudySession from './components/StudySession';
import Settings from './components/Settings';
import WordList from './components/WordList';
import { Sparkles, BrainCircuit, Settings as SettingsIcon, Library } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const { 
    words, 
    settings, 
    addWord, 
    addWords,
    updateWord, 
    updateSettings, 
    deleteWord, 
    importData,
    reviewHistory,
    recordReview,
    streak
  } = useVocab();
  const [activeTab, setActiveTab] = useState('study');

  const navItems = [
    { id: 'study', label: 'Study', icon: <BrainCircuit size={20} /> },
    { id: 'library', label: 'Library', icon: <Library size={20} /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon size={20} /> }
  ];

  return (
    <>
      <header className="app-header">
        <div className="app-title">
          <div style={{ 
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            padding: '0.5rem',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)'
          }}>
            <Sparkles size={28} color="white" />
          </div>
          SpacedRep
        </div>
        
        <nav style={{ display: 'flex', gap: '0.5rem', background: 'var(--glass-bg)', padding: '0.5rem', borderRadius: '999px', border: '1px solid var(--glass-border)' }}>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                background: activeTab === item.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                border: 'none',
                color: activeTab === item.id ? 'var(--text-main)' : 'var(--text-muted)',
                padding: '0.5rem 1rem',
                borderRadius: '999px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: 500,
                transition: 'all 0.2s ease'
              }}
            >
              {item.icon}
              <span style={{ display: window.innerWidth < 768 && activeTab !== item.id ? 'none' : 'inline' }}>
                {item.label}
              </span>
            </button>
          ))}
        </nav>
      </header>

      <main className="main-container" style={{ position: 'relative', width: '100%', height: '100%' }}>
        <AnimatePresence mode="wait">
          {activeTab === 'library' && (
            <motion.div
              key="library"
              initial={{ opacity: 0, y: 12, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.99 }}
              transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
              style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}
            >
              <WordList words={words} updateWord={updateWord} deleteWord={deleteWord} addWord={addWord} addWords={addWords} />
            </motion.div>
          )}
          
          {activeTab === 'study' && (
            <motion.div
              key="study"
              initial={{ opacity: 0, y: 12, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.99 }}
              transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
              style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}
            >
              <StudySession 
                words={words} 
                settings={settings} 
                onUpdateWord={updateWord} 
                recordReview={recordReview}
                streak={streak}
                reviewHistory={reviewHistory}
                isActive={activeTab === 'study'}
              />
            </motion.div>
          )}
          
          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 12, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.99 }}
              transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
              style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}
            >
              <Settings words={words} settings={settings} updateSettings={updateSettings} importData={importData} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}

export default App;
