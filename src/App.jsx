import React, { useState, Suspense, lazy } from 'react';
import { useVocab } from './hooks/useVocab';
import StudySession from './components/StudySession';
import { Sparkles, BrainCircuit, Settings as SettingsIcon, Library, Loader2 } from 'lucide-react';

const WordList = lazy(() => import('./components/WordList'));
const Settings = lazy(() => import('./components/Settings'));

const TabFallback = () => (
  <div className="tab-fallback">
    <Loader2 size={28} className="spin text-gradient" />
    <span className="text-muted" style={{ fontSize: '0.9rem' }}>Đang tải...</span>
  </div>
);

const AppSkeleton = () => (
  <div className="app-skeleton animate-fade-in">
    <div className="skeleton-header">
      <div className="skeleton-block" style={{ width: 140, height: 36, borderRadius: 12 }} />
      <div className="skeleton-block" style={{ width: 200, height: 40, borderRadius: 999 }} />
    </div>
    <div className="skeleton-body">
      <div className="skeleton-block" style={{ height: 100, borderRadius: 16 }} />
      <div className="skeleton-block" style={{ height: 220, borderRadius: 16 }} />
      <div className="skeleton-block" style={{ height: 48, borderRadius: 12 }} />
    </div>
  </div>
);

function App() {
  const {
    words,
    settings,
    topics,
    isLoading,
    addWord,
    addWords,
    updateWord,
    updateSettings,
    addTopic,
    deleteWord,
    clearAllWords,
    importData,
    importSnapshot,
    getFullSnapshotForBackup,
    reviewHistory,
    recordReview,
    undoRecordReview,
    streak,
  } = useVocab();

  const [activeTab, setActiveTab] = useState('study');

  const navItems = [
    { id: 'study', label: 'Học', icon: <BrainCircuit size={20} /> },
    { id: 'library', label: 'Thư viện', icon: <Library size={20} /> },
    { id: 'settings', label: 'Cài đặt', icon: <SettingsIcon size={20} /> },
  ];

  if (isLoading) {
    return <AppSkeleton />;
  }

  return (
    <>
      <header className="app-header">
        <div className="app-title">
          <div className="app-logo-icon">
            <Sparkles size={22} color="white" />
          </div>
          <span className="app-title-text">SpacedRep</span>
        </div>

        <nav className="app-nav app-nav-desktop" aria-label="Điều hướng chính">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`nav-pill ${activeTab === item.id ? 'nav-pill-active' : ''}`}
            >
              {item.icon}
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="main-container">
        <div className={`tab-panel ${activeTab === 'study' ? 'tab-panel-active' : ''}`}>
          {activeTab === 'study' && (
            <StudySession
              words={words}
              settings={settings}
              topics={topics}
              onUpdateWord={updateWord}
              onDeleteWord={deleteWord}
              recordReview={recordReview}
              undoRecordReview={undoRecordReview}
              streak={streak}
              reviewHistory={reviewHistory}
              isActive={activeTab === 'study'}
            />
          )}
        </div>

        <div className={`tab-panel ${activeTab === 'library' ? 'tab-panel-active' : ''}`}>
          {activeTab === 'library' && (
            <Suspense fallback={<TabFallback />}>
              <WordList
                words={words}
                settings={settings}
                topics={topics}
                addTopic={addTopic}
                updateWord={updateWord}
                deleteWord={deleteWord}
                addWord={addWord}
                addWords={addWords}
              />
            </Suspense>
          )}
        </div>

        <div className={`tab-panel ${activeTab === 'settings' ? 'tab-panel-active' : ''}`}>
          {activeTab === 'settings' && (
            <Suspense fallback={<TabFallback />}>
              <Settings
                words={words}
                settings={settings}
                updateSettings={updateSettings}
                importData={importData}
                importSnapshot={importSnapshot}
                getFullSnapshotForBackup={getFullSnapshotForBackup}
                clearAllWords={clearAllWords}
              />
            </Suspense>
          )}
        </div>
      </main>

      <nav className="app-nav-mobile" aria-label="Điều hướng di động">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`mobile-nav-item ${activeTab === item.id ? 'mobile-nav-active' : ''}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

export default App;
