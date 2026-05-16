import { useState, useEffect } from 'react';

const STORAGE_KEY = 'spacedrep_vocab_data';
const SETTINGS_KEY = 'spacedrep_settings';

export const useVocab = () => {
  const [words, setWords] = useState([]);
  const [settings, setSettings] = useState({
    dailyLimit: 20,
    intervalMultiplier: 1 // For future use if user wants to speed up/slow down
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load from local storage and auto-translate old words on mount
  useEffect(() => {
    const init = async () => {
      const storedWordsStr = localStorage.getItem(STORAGE_KEY);
      const storedSettingsStr = localStorage.getItem(SETTINGS_KEY);
      
      let initialWords = [];
      if (storedWordsStr) initialWords = JSON.parse(storedWordsStr);
      if (storedSettingsStr) setSettings(JSON.parse(storedSettingsStr));

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
    }
  }, [words, settings, isLoading]);

  const addWord = (newWord) => {
    setWords(prev => [newWord, ...prev]);
  };

  const updateWord = (updatedWord) => {
    setWords(prev => prev.map(w => w.id === updatedWord.id ? updatedWord : w));
  };

  const deleteWord = (id) => {
    setWords(prev => prev.filter(w => w.id !== id));
  };

  const updateSettings = (newSettings) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  // Reset `isReviewedToday` if it's a new day
  useEffect(() => {
    if (words.length > 0) {
      const today = new Date().setHours(0,0,0,0);
      let changed = false;
      
      const newWords = words.map(w => {
        if (w.isReviewedToday && w.lastReviewed) {
          const lastReviewDay = new Date(w.lastReviewed).setHours(0,0,0,0);
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

  return { words, settings, addWord, updateWord, deleteWord, updateSettings, importData };
};
