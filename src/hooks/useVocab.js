import { useState, useEffect, useRef, useCallback } from 'react';
import { DEFAULT_TOPICS } from '../utils/tags';

const STORAGE_KEY = 'spacedrep_vocab_data';
const SETTINGS_KEY = 'spacedrep_settings';
const HISTORY_KEY = 'spacedrep_review_history';
const TOPICS_KEY = 'spacedrep_topics';
const BACKUP_KEY = 'spacedrep_vocab_backup';
const BACKUP_DATE_KEY = 'spacedrep_last_backup_date';
const FULL_BACKUP_KEY = 'spacedrep_full_backup';

const DEFAULT_SETTINGS = {
  dailyLimit: 20,
  intervalMultiplier: 1,
  voiceURI: '',
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-flash-lite',
  theme: 'sepia',
  enableSentencePractice: true,
  maxSentenceWords: 5,
};

const formatDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const calculateStreak = (reviewHistory) => {
  const reviewedDates = new Set(
    Object.entries(reviewHistory)
      .filter(([, data]) => data.total > 0)
      .map(([dateStr]) => dateStr)
  );

  if (reviewedDates.size === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
    if (reviewedDates.has(formatDate(currentCheck))) {
      while (reviewedDates.has(formatDate(currentCheck))) {
        streak++;
        currentCheck.setDate(currentCheck.getDate() - 1);
      }
    }
  }

  return streak;
};

const safeParse = (str, fallback) => {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
};

const resetReviewedIfNewDay = (words) => {
  if (!words.length) return { words, changed: false };
  const today = new Date().setHours(0, 0, 0, 0);
  let changed = false;
  const next = words.map((w) => {
    if (w.isReviewedToday && w.lastReviewed) {
      const lastReviewDay = new Date(w.lastReviewed).setHours(0, 0, 0, 0);
      if (lastReviewDay < today) {
        changed = true;
        return { ...w, isReviewedToday: false };
      }
    }
    return w;
  });
  return { words: next, changed };
};

const translateOne = async (text) => {
  const res = await fetch(
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(text)}`
  );
  const data = await res.json();
  return data?.[0]?.[0]?.[0] || '';
};

/** Background fill missing Vietnamese meanings without blocking UI */
const fillMissingViMeanings = async (words, onBatch, concurrency = 4) => {
  const missing = words.filter((w) => w.id && w.word && !w.viMeaning);
  if (missing.length === 0) return;

  let cursor = 0;
  const results = new Map(); // id -> viMeaning

  const worker = async () => {
    while (cursor < missing.length) {
      const i = cursor++;
      const w = missing[i];
      try {
        const vi = await translateOne(w.word);
        if (vi) results.set(w.id, vi);
      } catch (e) {
        console.error('Background translate error', e);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, missing.length) }, () => worker())
  );

  if (results.size > 0) {
    onBatch((prev) => {
      let changed = false;
      const next = prev.map((w) => {
        const vi = results.get(w.id);
        if (vi && !w.viMeaning) {
          changed = true;
          return { ...w, viMeaning: vi };
        }
        return w;
      });
      return changed ? next : prev;
    });
  }
};

export const useVocab = () => {
  const [words, setWords] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [topics, setTopics] = useState([]);
  const [reviewHistory, setReviewHistory] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const saveTimerRef = useRef(null);
  const hydratedRef = useRef(false);

  // Load from localStorage immediately — never block on network
  useEffect(() => {
    const storedWords = safeParse(localStorage.getItem(STORAGE_KEY), []);
    const storedSettings = {
      ...DEFAULT_SETTINGS,
      ...safeParse(localStorage.getItem(SETTINGS_KEY), {}),
    };
    const storedTopics = safeParse(localStorage.getItem(TOPICS_KEY), null);
    const storedHistory = safeParse(localStorage.getItem(HISTORY_KEY), {});

    const topicsList = storedTopics?.length ? storedTopics : DEFAULT_TOPICS;
    if (!storedTopics?.length) {
      localStorage.setItem(TOPICS_KEY, JSON.stringify(DEFAULT_TOPICS));
    }

    let initialHistory = storedHistory;
    if (!Object.keys(initialHistory).length && storedWords.length > 0) {
      storedWords.forEach((w) => {
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
        localStorage.setItem(HISTORY_KEY, JSON.stringify(initialHistory));
      }
    }

    const { words: dayResetWords, changed } = resetReviewedIfNewDay(storedWords);

    setTopics(topicsList);
    setSettings(storedSettings);
    setReviewHistory(initialHistory);
    setWords(dayResetWords);
    setIsLoading(false);
    hydratedRef.current = true;

    // Apply theme ASAP
    document.documentElement.setAttribute('data-theme', storedSettings.theme || 'sepia');

    if (changed) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dayResetWords));
    }

    // Daily full backup (local)
    const todayDateStr = new Date().toISOString().split('T')[0];
    const lastBackupDate = localStorage.getItem(BACKUP_DATE_KEY);
    if (lastBackupDate !== todayDateStr && dayResetWords.length > 0) {
      localStorage.setItem(BACKUP_KEY, JSON.stringify(dayResetWords));
      localStorage.setItem(
        FULL_BACKUP_KEY,
        JSON.stringify({
          version: 2,
          exportedAt: new Date().toISOString(),
          words: dayResetWords,
          settings: storedSettings,
          topics: topicsList,
          reviewHistory: initialHistory,
        })
      );
      localStorage.setItem(BACKUP_DATE_KEY, todayDateStr);
    }

    // Background VI fill — non-blocking
    fillMissingViMeanings(dayResetWords, setWords).catch(() => {});
  }, []);

  // Apply theme when settings change
  useEffect(() => {
    if (settings.theme) {
      document.documentElement.setAttribute('data-theme', settings.theme);
    }
  }, [settings.theme]);

  // Debounced persist words/settings/topics
  useEffect(() => {
    if (!hydratedRef.current || isLoading) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        if (topics.length > 0) {
          localStorage.setItem(TOPICS_KEY, JSON.stringify(topics));
        }
      } catch (e) {
        console.error('localStorage save failed', e);
      }
    }, 300);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [words, settings, topics, isLoading]);

  // Midnight-ish: re-check isReviewedToday once when tab becomes visible next day
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      setWords((prev) => {
        const { words: next, changed } = resetReviewedIfNewDay(prev);
        return changed ? next : prev;
      });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const addTopic = useCallback((newTopic) => {
    if (newTopic) {
      setTopics((prev) => (prev.includes(newTopic) ? prev : [...prev, newTopic]));
    }
  }, []);

  const addWord = useCallback((newWord) => {
    setWords((prev) => [newWord, ...prev]);
  }, []);

  const addWords = useCallback((newWords) => {
    if (Array.isArray(newWords) && newWords.length > 0) {
      setWords((prev) => [...newWords, ...prev]);
    }
  }, []);

  const updateWord = useCallback((updatedWord) => {
    setWords((prev) => prev.map((w) => (w.id === updatedWord.id ? updatedWord : w)));
  }, []);

  const deleteWord = useCallback((id) => {
    setWords((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const clearAllWords = useCallback(() => {
    setWords([]);
  }, []);

  const updateSettings = useCallback((newSettings) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  /** Replace all words (legacy) */
  const importData = useCallback((importedWords) => {
    if (Array.isArray(importedWords)) {
      setWords(importedWords);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(importedWords));
    }
  }, []);

  /**
   * Import full snapshot or plain word array.
   * mode: 'replace' | 'merge'
   * merge keeps existing SRS when same word text exists; adds new words.
   */
  const importSnapshot = useCallback((payload, mode = 'replace') => {
    let incomingWords = [];
    let incomingSettings = null;
    let incomingTopics = null;
    let incomingHistory = null;

    if (Array.isArray(payload)) {
      incomingWords = payload;
    } else if (payload && typeof payload === 'object') {
      incomingWords = Array.isArray(payload.words) ? payload.words : [];
      if (payload.settings) incomingSettings = payload.settings;
      if (Array.isArray(payload.topics)) incomingTopics = payload.topics;
      if (payload.reviewHistory && typeof payload.reviewHistory === 'object') {
        incomingHistory = payload.reviewHistory;
      }
    } else {
      throw new Error('Định dạng file không hợp lệ.');
    }

    if (mode === 'replace') {
      setWords(incomingWords);
      if (incomingSettings) {
        setSettings((prev) => ({ ...DEFAULT_SETTINGS, ...prev, ...incomingSettings }));
      }
      if (incomingTopics) setTopics(incomingTopics);
      if (incomingHistory) {
        setReviewHistory(incomingHistory);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(incomingHistory));
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(incomingWords));
      return { added: incomingWords.length, updated: 0, total: incomingWords.length };
    }

    // merge by lowercase word text
    let added = 0;
    let updated = 0;
    setWords((prev) => {
      const map = new Map(prev.map((w) => [w.word.trim().toLowerCase(), w]));
      incomingWords.forEach((w) => {
        const key = (w.word || '').trim().toLowerCase();
        if (!key) return;
        if (map.has(key)) {
          const existing = map.get(key);
          map.set(key, {
            ...existing,
            meaning: w.meaning || existing.meaning,
            viMeaning: w.viMeaning || existing.viMeaning,
            phonetic: w.phonetic || existing.phonetic,
            example: w.example || existing.example,
            wordType: w.wordType || existing.wordType,
            tags: w.tags?.length ? w.tags : existing.tags,
          });
          updated += 1;
        } else {
          map.set(key, w);
          added += 1;
        }
      });
      return Array.from(map.values());
    });

    if (incomingTopics) {
      setTopics((prev) => {
        const set = new Set([...prev, ...incomingTopics]);
        return Array.from(set);
      });
    }

    if (incomingHistory) {
      setReviewHistory((prev) => {
        const merged = { ...prev };
        Object.entries(incomingHistory).forEach(([date, data]) => {
          if (!merged[date]) {
            merged[date] = data;
          } else {
            const reviewed = new Set([
              ...(merged[date].reviewedWords || []),
              ...(data.reviewedWords || []),
            ]);
            merged[date] = {
              total: (merged[date].total || 0) + (data.total || 0),
              correct: (merged[date].correct || 0) + (data.correct || 0),
              reviewedWords: Array.from(reviewed),
            };
          }
        });
        localStorage.setItem(HISTORY_KEY, JSON.stringify(merged));
        return merged;
      });
    }

    return { added, updated, total: incomingWords.length };
  }, []);

  const getFullSnapshot = useCallback(() => {
    return {
      version: 2,
      app: 'SpacedRep',
      exportedAt: new Date().toISOString(),
      words,
      settings: { ...settings, geminiApiKey: settings.geminiApiKey ? '***' : '' },
      topics,
      reviewHistory,
    };
  }, [words, settings, topics, reviewHistory]);

  /** Export with real API key for personal restore (user chooses) */
  const getFullSnapshotForBackup = useCallback(() => {
    return {
      version: 2,
      app: 'SpacedRep',
      exportedAt: new Date().toISOString(),
      words,
      settings,
      topics,
      reviewHistory,
    };
  }, [words, settings, topics, reviewHistory]);

  const recordReview = useCallback((wordId, grade) => {
    const todayStr = formatDate(new Date());
    const isCorrect = grade > 0;

    setReviewHistory((prev) => {
      const dayData = prev[todayStr] || { total: 0, correct: 0, reviewedWords: [] };
      const newDayData = {
        total: dayData.total + 1,
        correct: dayData.correct + (isCorrect ? 1 : 0),
        reviewedWords: dayData.reviewedWords
          ? dayData.reviewedWords.includes(wordId)
            ? dayData.reviewedWords
            : [...dayData.reviewedWords, wordId]
          : [wordId],
      };
      const updated = { ...prev, [todayStr]: newDayData };
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const undoRecordReview = useCallback((wordId, grade) => {
    const todayStr = formatDate(new Date());
    const wasCorrect = grade > 0;

    setReviewHistory((prev) => {
      const dayData = prev[todayStr];
      if (!dayData) return prev;
      const newDayData = {
        total: Math.max(0, (dayData.total || 0) - 1),
        correct: Math.max(0, (dayData.correct || 0) - (wasCorrect ? 1 : 0)),
        reviewedWords: (dayData.reviewedWords || []).filter((id) => id !== wordId),
      };
      const updated = { ...prev, [todayStr]: newDayData };
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const streak = calculateStreak(reviewHistory);

  return {
    words,
    settings,
    topics,
    isLoading,
    addWord,
    addWords,
    updateWord,
    deleteWord,
    clearAllWords,
    updateSettings,
    addTopic,
    importData,
    importSnapshot,
    getFullSnapshot,
    getFullSnapshotForBackup,
    reviewHistory,
    recordReview,
    undoRecordReview,
    streak,
  };
};
