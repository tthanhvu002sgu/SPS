import { useState, useEffect } from 'react';
import { DEFAULT_TOPICS } from '../utils/tags';

const STORAGE_KEY = 'spacedrep_vocab_data';
const SETTINGS_KEY = 'spacedrep_settings';

const calculateStreak = (reviewHistory) => {
  const reviewedDates = new Set(
    Object.entries(reviewHistory)
      .filter(([_, data]) => data.total > 0)
      .map(([dateStr]) => dateStr)
  );

  if (reviewedDates.size === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const formatDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  let streak = 0;
  let currentCheck = new Date(today);
  const todayStr = formatDate(currentCheck);

  if (reviewedDates.has(todayStr)) {
    while (reviewedDates.has(formatDate(currentCheck))) {
      streak++;
      currentCheck.setDate(currentCheck.getDate() - 1);
    }
  } else {
    currentCheck.setDate(currentCheck.getDate() - 1);
    const yesterdayStr = formatDate(currentCheck);
    if (reviewedDates.has(yesterdayStr)) {
      while (reviewedDates.has(formatDate(currentCheck))) {
        streak++;
        currentCheck.setDate(currentCheck.getDate() - 1);
      }
    }
  }

  return streak;
};

export const useVocab = () => {
  const [words, setWords] = useState([]);
  const [settings, setSettings] = useState({
    dailyLimit: 20,
    intervalMultiplier: 1 // For future use if user wants to speed up/slow down
  });
  const [topics, setTopics] = useState([]);
  const [reviewHistory, setReviewHistory] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // Load from local storage and auto-translate old words on mount
  useEffect(() => {
    const init = async () => {
      const storedWordsStr = localStorage.getItem(STORAGE_KEY);
      const storedSettingsStr = localStorage.getItem(SETTINGS_KEY);
      const storedHistoryStr = localStorage.getItem('spacedrep_review_history');
      const storedTopicsStr = localStorage.getItem('spacedrep_topics');

      if (storedTopicsStr) {
        setTopics(JSON.parse(storedTopicsStr));
      } else {
        setTopics(DEFAULT_TOPICS);
        localStorage.setItem('spacedrep_topics', JSON.stringify(DEFAULT_TOPICS));
      }

      let initialWords = [];
      if (storedWordsStr) initialWords = JSON.parse(storedWordsStr);
      if (storedSettingsStr) setSettings(JSON.parse(storedSettingsStr));

      let initialHistory = {};
      if (storedHistoryStr) {
        initialHistory = JSON.parse(storedHistoryStr);
      } else if (initialWords.length > 0) {
        const formatDate = (d) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        };

        initialWords.forEach(w => {
          if (w.lastReviewed) {
            const dateStr = formatDate(new Date(w.lastReviewed));
            if (!initialHistory[dateStr]) {
              initialHistory[dateStr] = { total: 0, correct: 0, reviewedWords: [] };
            }
            initialHistory[dateStr].total += 1;
            initialHistory[dateStr].correct += 1;
            if (!initialHistory[dateStr].reviewedWords.includes(w.id)) {
              initialHistory[dateStr].reviewedWords.push(w.id);
            }
          }
        });

        if (Object.keys(initialHistory).length > 0) {
          localStorage.setItem('spacedrep_review_history', JSON.stringify(initialHistory));
        }
      }
      setReviewHistory(initialHistory);

      let changed = false;
      const updatedWords = [...initialWords];

      for (let i = 0; i < updatedWords.length; i++) {
        if (!updatedWords[i].viMeaning) {
          try {
            const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(updatedWords[i].word)}`);
            const data = await res.json();
            updatedWords[i].viMeaning = data[0][0][0];
            changed = true;
          } catch (e) {
            console.error("Auto translate error on load", e);
          }
        }
      }

      setWords(updatedWords);
      if (changed) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedWords));
      }

      // Auto-backup once a day to a separate key
      const todayDateStr = new Date().toISOString().split('T')[0];
      const lastBackupDate = localStorage.getItem('spacedrep_last_backup_date');
      if (lastBackupDate !== todayDateStr && updatedWords.length > 0) {
        localStorage.setItem('spacedrep_vocab_backup', JSON.stringify(updatedWords));
        localStorage.setItem('spacedrep_last_backup_date', todayDateStr);
      }

      setIsLoading(false);
    };

    init();
  }, []);

  // Save to local storage when changed
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      if (topics.length > 0) {
        localStorage.setItem('spacedrep_topics', JSON.stringify(topics));
      }
    }
  }, [words, settings, topics, isLoading]);

  const addTopic = (newTopic) => {
    if (newTopic && !topics.includes(newTopic)) {
      setTopics(prev => [...prev, newTopic]);
    }
  };

  const addWord = (newWord) => {
    setWords(prev => [newWord, ...prev]);
  };

  const addWords = (newWords) => {
    if (Array.isArray(newWords) && newWords.length > 0) {
      setWords(prev => [...newWords, ...prev]);
    }
  };

  const updateWord = (updatedWord) => {
    setWords(prev => prev.map(w => w.id === updatedWord.id ? updatedWord : w));
  };

  const deleteWord = (id) => {
    setWords(prev => prev.filter(w => w.id !== id));
  };

  const clearAllWords = () => {
    setWords([]);
  };

  const updateSettings = (newSettings) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  // Reset `isReviewedToday` if it's a new day
  useEffect(() => {
    if (words.length > 0) {
      const today = new Date().setHours(0, 0, 0, 0);
      let changed = false;

      const newWords = words.map(w => {
        if (w.isReviewedToday && w.lastReviewed) {
          const lastReviewDay = new Date(w.lastReviewed).setHours(0, 0, 0, 0);
          if (lastReviewDay < today) {
            changed = true;
            return { ...w, isReviewedToday: false };
          }
        }
        return w;
      });

      if (changed) setWords(newWords);
    }
  }, [words]);

  const importData = (importedWords) => {
    if (Array.isArray(importedWords)) {
      setWords(importedWords);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(importedWords));
    }
  };

  const recordReview = (wordId, grade) => {
    const formatDate = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const todayStr = formatDate(new Date());
    const isCorrect = grade > 0;

    setReviewHistory(prev => {
      const dayData = prev[todayStr] || { total: 0, correct: 0, reviewedWords: [] };

      const newDayData = {
        total: dayData.total + 1,
        correct: dayData.correct + (isCorrect ? 1 : 0),
        reviewedWords: dayData.reviewedWords
          ? (dayData.reviewedWords.includes(wordId) ? dayData.reviewedWords : [...dayData.reviewedWords, wordId])
          : [wordId]
      };

      const updated = {
        ...prev,
        [todayStr]: newDayData
      };

      localStorage.setItem('spacedrep_review_history', JSON.stringify(updated));
      return updated;
    });
  };

  const streak = calculateStreak(reviewHistory);

  return {
    words,
    settings,
    topics,
    addWord,
    addWords,
    updateWord,
    deleteWord,
    clearAllWords,
    updateSettings,
    addTopic,
    importData,
    reviewHistory,
    recordReview,
    streak
  };
};
