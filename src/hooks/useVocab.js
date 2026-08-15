import { useState, useEffect, useRef, useCallback } from 'react';
import { normalizeWordTags } from '../utils/tags';
import {
  STORAGE_KEYS,
  safeGetItem,
  safeSetItem,
  safeRemoveItem,
  safeParse,
} from '../utils/storage';

const DEFAULT_SMART_FOLDERS = [
  { id: 'folder_smart_life', name: 'Đời sống & Giao tiếp', isDefault: false, wordIds: [], tags: ['Đời sống & giao tiếp'] },
  { id: 'folder_smart_work', name: 'Công việc & Kinh doanh', isDefault: false, wordIds: [], tags: ['Công việc & kinh doanh'] },
  { id: 'folder_smart_study', name: 'Học tập & Học thuật', isDefault: false, wordIds: [], tags: ['Học tập & học thuật'] },
  { id: 'folder_smart_tech', name: 'Công nghệ & Truyền thông', isDefault: false, wordIds: [], tags: ['Công nghệ & truyền thông'] },
];

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

const getUsedTags = (wordList) => {
  const set = new Set();
  (wordList || []).forEach((w) => {
    if (Array.isArray(w.tags)) {
      w.tags.forEach((t) => {
        if (t && typeof t === 'string' && t.trim()) {
          set.add(t.trim());
        }
      });
    }
  });
  return Array.from(set).sort();
};

export const useVocab = () => {
  const [words, setWords] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [topics, setTopics] = useState([]);
  const [folders, setFolders] = useState([]);
  const [reviewHistory, setReviewHistory] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const saveTimerRef = useRef(null);
  const hydratedRef = useRef(false);

  // Load from localStorage immediately — never block on network
  useEffect(() => {
    const storedWords = safeParse(safeGetItem(STORAGE_KEYS.WORDS), []);
    const storedSettings = {
      ...DEFAULT_SETTINGS,
      ...safeParse(safeGetItem(STORAGE_KEYS.SETTINGS), {}),
    };
    const storedFoldersRaw = safeParse(safeGetItem(STORAGE_KEYS.FOLDERS), null);
    const storedHistory = safeParse(safeGetItem(STORAGE_KEYS.HISTORY), {});

    // Clean up legacy redundant backup key to reclaim space if present
    safeRemoveItem(STORAGE_KEYS.LEGACY_BACKUP);

    const { words: dayResetWords } = resetReviewedIfNewDay(storedWords);
    const normalizedWords = dayResetWords.map((w) => normalizeWordTags(w));
    const initialUsedTags = getUsedTags(normalizedWords);
    safeSetItem(STORAGE_KEYS.TOPICS, JSON.stringify(initialUsedTags));
    
    let storedFolders = [];
    const baseDefault = { id: 'default', name: 'Default', isDefault: true, wordIds: [], tags: [] };
    
    if (!storedFoldersRaw) {
      storedFolders = [baseDefault, ...DEFAULT_SMART_FOLDERS];
      safeSetItem(STORAGE_KEYS.FOLDERS, JSON.stringify(storedFolders));
    } else {
      storedFolders = [...storedFoldersRaw];
      let hasChanges = false;
      DEFAULT_SMART_FOLDERS.forEach(smartFolder => {
        const exists = storedFolders.some(f => f.id === smartFolder.id || (f.tags || []).includes(smartFolder.tags[0]));
        if (!exists) {
          storedFolders.push(smartFolder);
          hasChanges = true;
        }
      });
      if (hasChanges) {
        safeSetItem(STORAGE_KEYS.FOLDERS, JSON.stringify(storedFolders));
      }
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
        safeSetItem(STORAGE_KEYS.HISTORY, JSON.stringify(initialHistory));
      }
    }

    setTopics(initialUsedTags);
    setFolders(storedFolders);
    setSettings(storedSettings);
    setReviewHistory(initialHistory);
    setWords(normalizedWords);
    setIsLoading(false);
    hydratedRef.current = true;

    // Apply theme ASAP
    document.documentElement.setAttribute('data-theme', storedSettings.theme || 'sepia');

    safeSetItem(STORAGE_KEYS.WORDS, JSON.stringify(normalizedWords), true);

    // Daily full backup (local) — single structured backup, never duplicate write
    const todayDateStr = new Date().toISOString().split('T')[0];
    const lastBackupDate = safeGetItem(STORAGE_KEYS.BACKUP_DATE);
    if (lastBackupDate !== todayDateStr && dayResetWords.length > 0) {
      const backupSaved = safeSetItem(
        STORAGE_KEYS.FULL_BACKUP,
        JSON.stringify({
          version: 2,
          exportedAt: new Date().toISOString(),
          words: dayResetWords,
          settings: storedSettings,
          topics: initialUsedTags,
          folders: storedFolders,
          reviewHistory: initialHistory,
        })
      );
      if (backupSaved) {
        safeSetItem(STORAGE_KEYS.BACKUP_DATE, todayDateStr);
      }
    }

    // Background VI fill — non-blocking
    fillMissingViMeanings(dayResetWords, setWords).catch(() => {});
  }, []);

  // Auto-prune tags when no words contain that tag
  useEffect(() => {
    if (!hydratedRef.current || isLoading) return;

    const currentUsedTags = getUsedTags(words);
    setTopics((prev) => {
      if (
        prev.length === currentUsedTags.length &&
        prev.every((t, i) => t === currentUsedTags[i])
      ) {
        return prev;
      }
      return currentUsedTags;
    });
  }, [words, isLoading]);

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
      safeSetItem(STORAGE_KEYS.WORDS, JSON.stringify(words), true);
      safeSetItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      safeSetItem(STORAGE_KEYS.TOPICS, JSON.stringify(topics));
      if (folders.length > 0) {
        safeSetItem(STORAGE_KEYS.FOLDERS, JSON.stringify(folders));
      }
    }, 300);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [words, settings, topics, folders, isLoading]);

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

  const addFolder = useCallback((newFolder) => {
    setFolders(prev => {
      const next = [...prev, newFolder];
      safeSetItem(STORAGE_KEYS.FOLDERS, JSON.stringify(next));
      return next;
    });
  }, []);

  const updateFolder = useCallback((updatedFolder) => {
    setFolders(prev => {
      const next = prev.map(f => f.id === updatedFolder.id ? updatedFolder : f);
      safeSetItem(STORAGE_KEYS.FOLDERS, JSON.stringify(next));
      return next;
    });
  }, []);

  const deleteFolder = useCallback((id) => {
    setFolders(prev => {
      const next = prev.filter(f => f.id !== id);
      safeSetItem(STORAGE_KEYS.FOLDERS, JSON.stringify(next));
      return next;
    });
  }, []);

  const addWord = useCallback((newWord) => {
    setWords((prev) => [normalizeWordTags(newWord), ...prev]);
  }, []);

  const addWords = useCallback((newWords) => {
    if (Array.isArray(newWords) && newWords.length > 0) {
      setWords((prev) => [...newWords.map((w) => normalizeWordTags(w)), ...prev]);
    }
  }, []);

  const batchUpdateWords = useCallback((updatedWordsList) => {
    if (!Array.isArray(updatedWordsList) || updatedWordsList.length === 0) return;
    const updateMap = new Map(updatedWordsList.map((w) => [w.id, normalizeWordTags(w)]));
    setWords((prev) => prev.map((w) => (updateMap.has(w.id) ? updateMap.get(w.id) : w)));
  }, []);

  const updateWord = useCallback((updatedWord) => {
    setWords((prev) => prev.map((w) => (w.id === updatedWord.id ? normalizeWordTags(updatedWord) : w)));
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
      const normalized = importedWords.map((w) => normalizeWordTags(w));
      setWords(normalized);
      safeSetItem(STORAGE_KEYS.WORDS, JSON.stringify(normalized), true);
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
    let incomingFolders = null;
    let incomingHistory = null;

    if (Array.isArray(payload)) {
      incomingWords = payload;
    } else if (payload && typeof payload === 'object') {
      incomingWords = Array.isArray(payload.words) ? payload.words : [];
      if (payload.settings) incomingSettings = payload.settings;
      if (Array.isArray(payload.topics)) incomingTopics = payload.topics;
      if (Array.isArray(payload.folders)) incomingFolders = payload.folders;
      if (payload.reviewHistory && typeof payload.reviewHistory === 'object') {
        incomingHistory = payload.reviewHistory;
      }
    } else {
      throw new Error('Định dạng file không hợp lệ.');
    }

    const normalizedIncoming = incomingWords.map((w) => normalizeWordTags(w));

    if (mode === 'replace') {
      setWords(normalizedIncoming);
      if (incomingSettings) {
        setSettings((prev) => ({ ...DEFAULT_SETTINGS, ...prev, ...incomingSettings }));
      }
      if (incomingTopics) setTopics(incomingTopics);
      if (incomingFolders) {
        setFolders(incomingFolders);
        safeSetItem(STORAGE_KEYS.FOLDERS, JSON.stringify(incomingFolders));
      }
      if (incomingHistory) {
        setReviewHistory(incomingHistory);
        safeSetItem(STORAGE_KEYS.HISTORY, JSON.stringify(incomingHistory));
      }
      safeSetItem(STORAGE_KEYS.WORDS, JSON.stringify(normalizedIncoming), true);
      return { added: normalizedIncoming.length, updated: 0, total: normalizedIncoming.length };
    }

    // merge by lowercase word text
    let added = 0;
    let updated = 0;
    setWords((prev) => {
      const map = new Map(prev.map((w) => [w.word.trim().toLowerCase(), w]));
      normalizedIncoming.forEach((w) => {
        const key = (w.word || '').trim().toLowerCase();
        if (!key) return;
        if (map.has(key)) {
          const existing = map.get(key);
          map.set(key, normalizeWordTags({
            ...existing,
            meaning: w.meaning || existing.meaning,
            viMeaning: w.viMeaning || existing.viMeaning,
            phonetic: w.phonetic || existing.phonetic,
            example: w.example || existing.example,
            collocations: (w.collocations && w.collocations.length > 0) ? w.collocations : existing.collocations,
            wordType: w.wordType || existing.wordType,
            tags: w.tags?.length ? w.tags : existing.tags,
          }));
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

    if (incomingFolders) {
      setFolders((prev) => {
        const map = new Map(prev.map(f => [f.id, f]));
        incomingFolders.forEach(f => {
          if (!map.has(f.id)) map.set(f.id, f);
        });
        return Array.from(map.values());
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
        safeSetItem(STORAGE_KEYS.HISTORY, JSON.stringify(merged));
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
      folders,
      reviewHistory,
    };
  }, [words, settings, topics, folders, reviewHistory]);

  /** Export with real API key for personal restore (user chooses) */
  const getFullSnapshotForBackup = useCallback(() => {
    return {
      version: 2,
      app: 'SpacedRep',
      exportedAt: new Date().toISOString(),
      words,
      settings,
      topics,
      folders,
      reviewHistory,
    };
  }, [words, settings, topics, folders, reviewHistory]);

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
      safeSetItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
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
      safeSetItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const streak = calculateStreak(reviewHistory);

  return {
    words,
    settings,
    topics,
    folders,
    isLoading,
    addWord,
    addWords,
    updateWord,
    batchUpdateWords,
    deleteWord,
    clearAllWords,
    updateSettings,
    addTopic,
    addFolder,
    updateFolder,
    deleteFolder,
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
