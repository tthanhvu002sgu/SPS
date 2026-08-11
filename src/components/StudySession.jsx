import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Frown,
  Sparkles,
  Coffee,
  Volume2,
  Edit,
  Loader2,
  Trash2,
  Undo2,
  SkipForward,
  Folder,
} from 'lucide-react';
import { processReview } from '../utils/srs';
import { formatLineBreaks } from '../utils/formatText';
import Dashboard from './Dashboard';

const MarkdownText = ({ text }) => {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-main)', fontFamily: 'var(--font-family)' }}>
      {lines.map((line, i) => {
        const isList = line.trim().startsWith('* ') || line.trim().startsWith('- ');
        const rawContent = isList ? line.trim().substring(2) : line;
        const formatted = rawContent
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>');

        if (isList) {
          return (
            <div key={i} style={{ display: 'flex', marginBottom: '0.4rem', marginLeft: '1rem' }}>
              <span style={{ marginRight: '0.5rem', color: 'var(--accent-primary)' }}>•</span>
              <span dangerouslySetInnerHTML={{ __html: formatted }} />
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} style={{ height: '0.8rem' }} />;
        return (
          <div key={i} style={{ marginBottom: '0.4rem' }} dangerouslySetInnerHTML={{ __html: formatted }} />
        );
      })}
    </div>
  );
};

const StudySession = ({
  words,
  settings,
  topics = [],
  folders = [],
  onUpdateWord,
  onDeleteWord,
  recordReview,
  undoRecordReview,
  streak,
  reviewHistory,
  isActive,
}) => {
  const [queue, setQueue] = useState([]);
  const [currentWord, setCurrentWord] = useState(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [practiceMode, setPracticeMode] = useState(false);
  const [isStudying, setIsStudying] = useState(false);
  const [randomFrontBack, setRandomFrontBack] = useState(false);
  const [showReverse, setShowReverse] = useState(false);
  const [skipSentenceThisSession, setSkipSentenceThisSession] = useState(false);
  const [filterFolderId, setFilterFolderId] = useState('default');
  const [filterTag, setFilterTag] = useState('');
  const [sessionTotal, setSessionTotal] = useState(0);
  const [undoStack, setUndoStack] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editWord, setEditWord] = useState('');
  const [editPhonetic, setEditPhonetic] = useState('');
  const [editMeaning, setEditMeaning] = useState('');
  const [editViMeaning, setEditViMeaning] = useState('');
  const [editExample, setEditExample] = useState('');
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  const [editError, setEditError] = useState('');

  const [sessionPhase, setSessionPhase] = useState('flashcards');
  const [reviewedWords, setReviewedWords] = useState([]);
  const [sentenceQueue, setSentenceQueue] = useState([]);
  const [currentSentenceWord, setCurrentSentenceWord] = useState(null);
  const [userSentence, setUserSentence] = useState('');
  const [aiFeedback, setAiFeedback] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const gradeRef = useRef(null);

  const availableTags = useMemo(() => {
    const set = new Set();
    let sourceWords = words;
    if (filterFolderId && filterFolderId !== 'default') {
      const activeFolder = folders.find((f) => f.id === filterFolderId);
      if (activeFolder) {
        sourceWords = words.filter((w) => {
          const hasTag = (w.tags || []).some((t) => (activeFolder.tags || []).includes(t));
          const hasType = (activeFolder.tags || []).includes(w.wordType);
          const hasId = (activeFolder.wordIds || []).includes(w.id);
          return hasTag || hasType || hasId;
        });
      }
    }
    sourceWords.forEach((w) => (w.tags || []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [words, folders, filterFolderId]);

  const filteredPool = useMemo(() => {
    let pool = words;

    if (filterFolderId && filterFolderId !== 'default') {
      const activeFolder = folders.find((f) => f.id === filterFolderId);
      if (activeFolder) {
        pool = pool.filter((w) => {
          const hasTag = (w.tags || []).some((t) => (activeFolder.tags || []).includes(t));
          const hasType = (activeFolder.tags || []).includes(w.wordType);
          const hasId = (activeFolder.wordIds || []).includes(w.id);
          return hasTag || hasType || hasId;
        });
      }
    }

    if (filterTag) {
      pool = pool.filter((w) => (w.tags || []).includes(filterTag));
    }

    return pool;
  }, [words, filterFolderId, folders, filterTag]);

  const translateToVi = async (text) => {
    try {
      const res = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(text)}`
      );
      const data = await res.json();
      return data[0][0][0];
    } catch (e) {
      console.error('Translation error', e);
      return '';
    }
  };

  const fetchFromDictionary = async (searchWord) => {
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${searchWord}`);
      if (!response.ok) return null;
      const json = await response.json();
      const data = json[0];
      let fetchedMeaning = '';
      let fetchedExample = '';
      let fetchedPhonetic = data.phonetic || '';
      if (!fetchedPhonetic && data.phonetics) {
        const p = data.phonetics.find((ph) => ph.text);
        if (p) fetchedPhonetic = p.text;
      }
      if (data.meanings?.length > 0) {
        fetchedMeaning = data.meanings[0].definitions[0]?.definition || '';
        fetchedExample = data.meanings[0].definitions[0]?.example || '';
        for (const meaning of data.meanings) {
          for (const def of meaning.definitions) {
            if (def.example) {
              fetchedMeaning = def.definition;
              fetchedExample = def.example;
              break;
            }
          }
          if (fetchedExample) break;
        }
      }
      return { fetchedMeaning, fetchedExample, fetchedPhonetic };
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  useEffect(() => {
    if (currentWord && randomFrontBack) {
      setShowReverse(Math.random() < 0.5);
    } else {
      setShowReverse(false);
    }
  }, [currentWord, randomFrontBack]);

const shuffleArray = (arr) => {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

  const finishFlashcards = useCallback(
    (finalReviewed) => {
      const enableSentence = settings.enableSentencePractice !== false && !skipSentenceThisSession;
      let toPractice = shuffleArray(
        finalReviewed.filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i)
      );

      const maxN = Number(settings.maxSentenceWords);
      if (Number.isFinite(maxN) && maxN > 0) {
        toPractice = toPractice.slice(0, maxN);
      }

      if (enableSentence && toPractice.length > 0) {
        setSentenceQueue(toPractice);
        setCurrentSentenceWord(toPractice[0]);
        setUserSentence('');
        setAiFeedback('');
        setSessionPhase('sentence');
      } else {
        setSessionComplete(true);
        setSessionPhase('complete');
      }
    },
    [settings.enableSentencePractice, settings.maxSentenceWords, skipSentenceThisSession]
  );

  const handleStartStudy = () => {
    let list;
    if (practiceMode) {
      list = shuffleArray(filteredPool);
    } else {
      const today = new Date().setHours(0, 0, 0, 0);
      const reviewedCount = filteredPool.filter((w) => w.isReviewedToday).length;
      const remainingQuota = Math.max(0, settings.dailyLimit - reviewedCount);
      let dueWords = filteredPool.filter((w) => w.nextReviewDate <= today && !w.isReviewedToday);
      
      // Group dueWords by nextReviewDate to maintain SRS priority (overdue first)
      // while shuffling words that share the same review date (e.g. newly added words)
      const groupsMap = new Map();
      dueWords.forEach((w) => {
        const dateKey = w.nextReviewDate || 0;
        if (!groupsMap.has(dateKey)) {
          groupsMap.set(dateKey, []);
        }
        groupsMap.get(dateKey).push(w);
      });

      const sortedKeys = Array.from(groupsMap.keys()).sort((a, b) => a - b);
      let prioritizedShuffled = [];
      sortedKeys.forEach((key) => {
        prioritizedShuffled = prioritizedShuffled.concat(shuffleArray(groupsMap.get(key)));
      });

      list = prioritizedShuffled.slice(0, remainingQuota);
    }

    setQueue(list);
    setSessionTotal(list.length);
    setReviewedWords([]);
    setUndoStack(null);
    if (list.length > 0) {
      setCurrentWord(list[0]);
      setSessionComplete(false);
      setSessionPhase('flashcards');
    } else {
      setSessionComplete(true);
      setSessionPhase('complete');
    }
    setIsStudying(true);
  };

  const handleExitSession = () => {
    setIsStudying(false);
    setSessionComplete(false);
    setSessionPhase('flashcards');
    setCurrentWord(null);
    setQueue([]);
    setSentenceQueue([]);
    setIsEditing(false);
    setUndoStack(null);
  };

  const handleFlip = () => setIsFlipped(true);

  const handleGrade = useCallback(
    (grade) => {
      if (!currentWord) return;

      const previousWord = { ...currentWord };
      let updatedWord = currentWord;
      if (!practiceMode) {
        updatedWord = processReview(currentWord, grade, settings.intervalMultiplier || 1);
        onUpdateWord(updatedWord);
      }

      if (recordReview) recordReview(currentWord.id, grade);

      const nextReviewed =
        grade > 0 && !reviewedWords.find((w) => w.id === currentWord.id)
          ? [...reviewedWords, currentWord]
          : reviewedWords;

      if (grade > 0) setReviewedWords(nextReviewed);

      setUndoStack({
        previousWord,
        grade,
        practiceMode,
        queueSnapshot: queue,
        reviewedSnapshot: reviewedWords,
        wasUpdated: !practiceMode,
        updatedWordId: updatedWord.id,
      });

      setIsFlipped(false);
      const newQueue = queue.slice(1);
      setQueue(newQueue);

      if (newQueue.length > 0) {
        setTimeout(() => setCurrentWord(newQueue[0]), 150);
      } else {
        finishFlashcards(nextReviewed);
      }
    },
    [
      currentWord,
      practiceMode,
      settings.intervalMultiplier,
      onUpdateWord,
      recordReview,
      reviewedWords,
      queue,
      finishFlashcards,
    ]
  );

  gradeRef.current = handleGrade;

  const handleUndo = () => {
    if (!undoStack || sessionPhase !== 'flashcards') return;
    const {
      previousWord,
      grade,
      practiceMode: wasPractice,
      queueSnapshot,
      reviewedSnapshot,
      wasUpdated,
    } = undoStack;

    if (wasUpdated) {
      onUpdateWord(previousWord);
    }
    if (undoRecordReview) {
      undoRecordReview(previousWord.id, grade);
    }

    setQueue(queueSnapshot);
    setReviewedWords(reviewedSnapshot);
    setCurrentWord(previousWord);
    setIsFlipped(true);
    setUndoStack(null);
    setSessionComplete(false);
    setSessionPhase('flashcards');
  };

  const handleVerifySentence = async () => {
    if (!userSentence.trim() || !currentSentenceWord) return;
    if (!settings.geminiApiKey) {
      setAiFeedback(
        'Vui lòng vào phần Cài đặt để nhập Gemini API Key trước khi dùng tính năng này.'
      );
      return;
    }

    setIsVerifying(true);
    setAiFeedback('');
    try {
      const prompt = `Bạn là một giáo viên tiếng Anh bản xứ dạy học viên Việt Nam.
Người dùng đang học từ vựng tiếng Anh sau: "${currentSentenceWord.word}" (nghĩa tiếng Việt: ${currentSentenceWord.viMeaning || 'chưa rõ'}).
Họ đã đặt câu sau: "${userSentence}".

Hãy nhận xét chi tiết và trả lời ngắn gọn bằng tiếng Việt theo định dạng/tiêu chí sau:
1. **Ngữ pháp & Độ tự nhiên**: Nhận xét xem câu có đúng ngữ pháp không, diễn đạt tự nhiên không.
2. **Cách sử dụng từ khóa**: Người dùng có sử dụng từ khóa "${currentSentenceWord.word}" (hoặc các dạng chia từ phù hợp như chia thì, số nhiều, danh động từ...) đúng ngữ cảnh không?
3. **Gợi ý sửa đổi**: 
   - Đưa ra phương án sửa đổi hoặc câu viết lại tối ưu nhất nếu câu của người dùng chưa chuẩn.
   - **RÀNG BUỘC CỰC KỲ QUAN TRỌNG**: Phương án sửa đổi BẮT BUỘC phải giữ lại và sử dụng chính xác từ khóa "${currentSentenceWord.word}" (hoặc biến thể chia từ đúng của nó). TUYỆT ĐỐI KHÔNG ĐƯỢC thay thế từ khóa này bằng các từ đồng nghĩa khác.
   - Hãy in đậm từ khóa đó trong câu gợi ý để người học dễ nhận biết.`;

      const model = settings.geminiModel || 'gemini-2.5-flash-lite';
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );

      const data = await res.json();
      if (data.error) {
        setAiFeedback('Lỗi từ API: ' + data.error.message);
      } else if (data.candidates?.length > 0) {
        setAiFeedback(data.candidates[0].content.parts[0].text);
      } else {
        setAiFeedback('Không nhận được phản hồi hợp lệ từ AI.');
      }
    } catch {
      setAiFeedback('Lỗi mạng: Không thể kết nối tới Google API.');
    }
    setIsVerifying(false);
  };

  const handleNextSentence = () => {
    const nextQ = sentenceQueue.slice(1);
    setSentenceQueue(nextQ);
    setUserSentence('');
    setAiFeedback('');
    if (nextQ.length > 0) {
      setCurrentSentenceWord(nextQ[0]);
    } else {
      setSessionPhase('complete');
      setSessionComplete(true);
    }
  };

  const handleSkipAllSentences = () => {
    setSessionPhase('complete');
    setSessionComplete(true);
    setSentenceQueue([]);
  };

  useEffect(() => {
    if (!isActive || sessionPhase !== 'sentence') return;

    const handleSentenceKey = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        if (e.target.tagName === 'BUTTON') return;
        e.preventDefault();
        if (aiFeedback) {
          const isError =
            aiFeedback.startsWith('Lỗi') ||
            aiFeedback.startsWith('Không') ||
            aiFeedback.includes('Vui lòng vào phần Cài đặt');
          if (!isError) handleNextSentence();
        } else if (userSentence.trim() && !isVerifying) {
          handleVerifySentence();
        }
      }
    };

    window.addEventListener('keydown', handleSentenceKey);
    return () => window.removeEventListener('keydown', handleSentenceKey);
  });

  const speakWord = React.useCallback(
    (text, e) => {
      if (e) e.stopPropagation();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        if (settings.voiceURI) {
          const voices = window.speechSynthesis.getVoices();
          const selectedVoice = voices.find((v) => v.voiceURI === settings.voiceURI);
          if (selectedVoice) utterance.voice = selectedVoice;
        } else {
          utterance.lang = 'en-US';
        }
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
      }
    },
    [settings.voiceURI]
  );

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e) => {
      if (isEditing || sessionPhase === 'sentence') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (sessionComplete || !currentWord) return;

      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleUndo();
        return;
      }

      if (e.key === 'Control' || e.key === 'Enter') {
        e.preventDefault();
        if (!showReverse || isFlipped) speakWord(currentWord.word);
        return;
      }

      if (!isFlipped) {
        if (e.key === ' ') {
          e.preventDefault();
          handleFlip();
        }
      } else {
        if (e.key === '1') {
          e.preventDefault();
          gradeRef.current?.(0);
        } else if (e.key === '2') {
          e.preventDefault();
          gradeRef.current?.(3);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isActive,
    isFlipped,
    sessionComplete,
    currentWord,
    speakWord,
    showReverse,
    isEditing,
    sessionPhase,
    undoStack,
  ]);

  const handleStartEdit = (e) => {
    if (e) e.stopPropagation();
    if (!currentWord) return;
    setEditWord(currentWord.word || '');
    setEditPhonetic(currentWord.phonetic || '');
    setEditMeaning(currentWord.meaning || '');
    setEditViMeaning(currentWord.viMeaning || '');
    setEditExample(currentWord.example || '');
    setEditError('');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditError('');
  };

  const handleAutoLookup = async () => {
    if (!editWord.trim()) return;
    setIsAutoLoading(true);
    setEditError('');
    try {
      const dictData = await fetchFromDictionary(editWord.trim());
      if (dictData) {
        if (dictData.fetchedPhonetic) setEditPhonetic(dictData.fetchedPhonetic);
        if (dictData.fetchedMeaning) setEditMeaning(dictData.fetchedMeaning);
        if (dictData.fetchedExample) setEditExample(dictData.fetchedExample);
      }
      const translated = await translateToVi(editWord.trim());
      if (translated) setEditViMeaning(translated);
    } catch {
      setEditError('Lỗi khi tự động tra cứu từ vựng.');
    } finally {
      setIsAutoLoading(false);
    }
  };

  const handleSaveEdit = () => {
    if (!editWord.trim()) {
      setEditError('Từ tiếng Anh không được để trống.');
      return;
    }
    const updatedWord = {
      ...currentWord,
      word: editWord.trim(),
      phonetic: editPhonetic.trim(),
      meaning: editMeaning.trim(),
      viMeaning: editViMeaning.trim(),
      example: editExample.trim(),
    };
    onUpdateWord(updatedWord);
    setCurrentWord(updatedWord);
    setQueue((prev) => prev.map((w) => (w.id === updatedWord.id ? updatedWord : w)));
    setIsEditing(false);
  };

  const handleDeleteWord = (wordToDelete, e) => {
    if (e) e.stopPropagation();
    if (!wordToDelete) return;
    if (!window.confirm(`Xóa từ "${wordToDelete.word}"?`)) return;
    if (onDeleteWord) onDeleteWord(wordToDelete.id);
    setIsEditing(false);
    setUndoStack(null);

    if (sessionPhase === 'flashcards') {
      const nextQueue = queue.filter((w) => w.id !== wordToDelete.id);
      const nextReviewed = reviewedWords.filter((w) => w.id !== wordToDelete.id);
      setReviewedWords(nextReviewed);
      setQueue(nextQueue);
      setIsFlipped(false);
      if (nextQueue.length > 0) {
        setCurrentWord(nextQueue[0]);
      } else {
        finishFlashcards(nextReviewed);
      }
    } else if (sessionPhase === 'sentence') {
      const nextQ = sentenceQueue.filter((w) => w.id !== wordToDelete.id);
      setSentenceQueue(nextQ);
      setUserSentence('');
      setAiFeedback('');
      if (nextQ.length > 0) setCurrentSentenceWord(nextQ[0]);
      else {
        setSessionComplete(true);
        setSessionPhase('complete');
      }
    }
  };

  const doneCount = Math.max(0, sessionTotal - queue.length);
  const progressPct = sessionTotal > 0 ? Math.round((doneCount / sessionTotal) * 100) : 0;

  if (!isStudying) {
    const today = new Date().setHours(0, 0, 0, 0);
    const reviewedCount = filteredPool.filter((w) => w.isReviewedToday).length;
    const remainingQuota = Math.max(0, settings.dailyLimit - reviewedCount);
    const dueWords = filteredPool.filter((w) => w.nextReviewDate <= today && !w.isReviewedToday);
    const dueCount = Math.min(dueWords.length, remainingQuota);

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          gap: '1rem',
          overflowY: 'auto',
          paddingBottom: '1.5rem',
        }}
      >
        <Dashboard words={words} streak={streak} reviewHistory={reviewHistory} compact={false} />

        <div
          className="glass-panel"
          style={{
            padding: '1.5rem',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
              Mục tiêu học hôm nay
            </h3>
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>
              Chọn chế độ, lọc theo chủ đề nếu cần, rồi bắt đầu ôn để giữ streak.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.5rem',
              background: 'rgba(0,0,0,0.08)',
              padding: '0.25rem',
              borderRadius: '12px',
            }}
          >
            <button
              type="button"
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
                boxShadow: !practiceMode ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              SRS (hàng ngày)
            </button>
            <button
              type="button"
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
                boxShadow: practiceMode ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              Luyện tự do
            </button>
          </div>

          {folders.length > 0 && (
            <div>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Folder size={15} className="text-gradient" /> Chọn Thư mục học:
              </p>
              <div className="filter-chips">
                {folders.map((f) => {
                  const count = f.isDefault
                    ? words.length
                    : words.filter((w) => {
                        const hasTag = (w.tags || []).some((t) => (f.tags || []).includes(t));
                        const hasType = (f.tags || []).includes(w.wordType);
                        const hasId = (f.wordIds || []).includes(w.id);
                        return hasTag || hasType || hasId;
                      }).length;

                  return (
                    <button
                      key={f.id}
                      type="button"
                      className={`chip ${filterFolderId === f.id ? 'chip-active' : ''}`}
                      onClick={() => {
                        setFilterFolderId(f.id);
                        setFilterTag('');
                      }}
                    >
                      {f.name} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {availableTags.length > 0 && (
            <div>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                Lọc theo chủ đề (tag)
              </p>
              <div className="filter-chips">
                <button
                  type="button"
                  className={`chip ${!filterTag ? 'chip-active' : ''}`}
                  onClick={() => setFilterTag('')}
                >
                  Tất cả
                </button>
                {availableTags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`chip ${filterTag === t ? 'chip-active' : ''}`}
                    onClick={() => setFilterTag(filterTag === t ? '' : t)}
                  >
                    #{t}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div
            style={{
              background: 'rgba(128,128,128,0.06)',
              border: '1px solid var(--glass-border)',
              padding: '1rem',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(59, 130, 246, 0.12))',
                color: 'var(--accent-primary)',
                padding: '0.75rem',
                borderRadius: '50%',
                display: 'flex',
              }}
            >
              <Brain size={24} />
            </div>
            <div style={{ flex: 1 }}>
              {!practiceMode ? (
                <>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                    {dueCount > 0 ? (
                      <>
                        Hôm nay có{' '}
                        <span style={{ color: 'var(--accent-primary)', fontWeight: 800 }}>{dueCount}</span> từ
                        cần ôn
                        {filterTag ? ` (#${filterTag})` : ''}.
                      </>
                    ) : (
                      <span style={{ color: 'var(--accent-success)' }}>
                        {words.length === 0
                          ? 'Chưa có từ nào — vào Thư viện để thêm từ nhé!'
                          : filterTag
                            ? `Không còn từ #${filterTag} đến hạn hôm nay.`
                            : 'Tuyệt vời! Bạn đã xong bài SRS hôm nay.'}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    {dueCount > 0
                      ? 'Hàng đợi theo thuật toán lặp lại ngắt quãng (SRS).'
                      : words.length === 0
                        ? 'Thêm từ thủ công, nhanh, hoặc import Excel/CSV.'
                        : 'Chuyển Luyện tự do để ôn thêm, hoặc lọc tag khác.'}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                    Luyện tự do với{' '}
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 800 }}>
                      {filteredPool.length}
                    </span>{' '}
                    từ{filterTag ? ` (#${filterTag})` : ''}.
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    Không giới hạn quota và không ảnh hưởng lịch SRS.
                  </div>
                </>
              )}
            </div>
          </div>

          <div
            style={{
              background: 'rgba(128,128,128,0.05)',
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              border: '1px solid var(--glass-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              cursor: 'pointer',
              userSelect: 'none',
            }}
            onClick={() => setRandomFrontBack((p) => !p)}
          >
            <input
              type="checkbox"
              checked={randomFrontBack}
              onChange={(e) => {
                e.stopPropagation();
                setRandomFrontBack(e.target.checked);
              }}
              style={{ width: 18, height: 18, accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
            />
            <div>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Xáo trộn mặt thẻ (Anh ↔ Việt)</span>
              <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                Học ngẫu nhiên cả hai chiều để nhớ chắc hơn.
              </div>
            </div>
          </div>

          <div
            style={{
              background: 'rgba(128,128,128,0.05)',
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              border: '1px solid var(--glass-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              cursor: 'pointer',
              userSelect: 'none',
            }}
            onClick={() => setSkipSentenceThisSession((p) => !p)}
          >
            <input
              type="checkbox"
              checked={skipSentenceThisSession}
              onChange={(e) => {
                e.stopPropagation();
                setSkipSentenceThisSession(e.target.checked);
              }}
              style={{ width: 18, height: 18, accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
            />
            <div>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Bỏ qua bài đặt câu phiên này</span>
              <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                Mặc định cài đặt:{' '}
                {settings.enableSentencePractice === false
                  ? 'tắt'
                  : `bật (tối đa ${settings.maxSentenceWords ?? 5} từ)`}
                . Tick để chỉ làm flashcard.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleStartStudy}
            disabled={(!practiceMode && dueCount === 0) || (practiceMode && filteredPool.length === 0)}
            className="btn btn-primary"
            style={{
              padding: '0.9rem',
              fontSize: '1rem',
              fontWeight: 700,
              borderRadius: '12px',
            }}
          >
            Bắt đầu học
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        gap: '0.75rem',
        overflow: 'hidden',
      }}
    >
      <div
        className="glass-panel"
        style={{
          padding: '0.55rem 0.85rem',
          borderRadius: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={handleExitSession}
          className="btn btn-outline"
          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderRadius: '8px' }}
        >
          ← Dashboard
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          {sessionPhase === 'flashcards' && undoStack && (
            <button
              type="button"
              onClick={handleUndo}
              className="btn btn-outline"
              style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', borderRadius: '8px' }}
              title="Hoàn tác chấm điểm (Ctrl+Z)"
            >
              <Undo2 size={14} /> Hoàn tác
            </button>
          )}
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-muted)',
              background: 'rgba(128,128,128,0.08)',
              padding: '0.25rem 0.6rem',
              borderRadius: '999px',
              border: '1px solid var(--glass-border)',
            }}
          >
            {practiceMode ? 'Luyện tự do' : 'SRS'}
            {filterTag ? ` · #${filterTag}` : ''}
          </span>
        </div>
      </div>

      {sessionPhase === 'complete' ? (
        <div
          className="glass-panel flex-center"
          style={{ flexDirection: 'column', textAlign: 'center', flex: 1, minHeight: 0 }}
        >
          <div
            style={{
              background: 'rgba(16,185,129,0.1)',
              color: 'var(--accent-success)',
              padding: '1.5rem',
              borderRadius: '50%',
              marginBottom: '1rem',
            }}
          >
            <Coffee size={48} />
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Tuyệt vời!</h2>
          <p className="text-muted" style={{ fontSize: '0.9rem', maxWidth: '380px', marginBottom: '1.5rem' }}>
            {practiceMode
              ? 'Bạn đã hoàn thành phiên luyện tập!'
              : 'Bạn đã xong các từ cần ôn hôm nay!'}
          </p>
          <button
            type="button"
            onClick={handleExitSession}
            className="btn btn-primary"
            style={{ padding: '0.6rem 1.5rem', borderRadius: '8px' }}
          >
            Về Dashboard
          </button>
        </div>
      ) : sessionPhase === 'sentence' ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '0.5rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                background: 'var(--glass-bg)',
                padding: '0.3rem 1rem',
                borderRadius: '999px',
                border: '1px solid var(--glass-border)',
                fontSize: '0.85rem',
              }}
            >
              Đặt câu — còn <strong className="text-gradient">{sentenceQueue.length}</strong> từ
            </div>
            <button
              type="button"
              onClick={handleSkipAllSentences}
              className="btn btn-outline"
              style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem', borderRadius: '8px' }}
            >
              <SkipForward size={14} /> Bỏ qua phần này
            </button>
          </div>

          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '600px',
              padding: '1.5rem',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', textAlign: 'center', flex: 1, margin: 0 }}>
                Hãy đặt một câu tiếng Anh với từ:
              </h3>
              <button
                type="button"
                onClick={(e) => handleDeleteWord(currentSentenceWord, e)}
                className="btn btn-outline"
                style={{
                  padding: '0.4rem',
                  borderRadius: '8px',
                  color: 'var(--accent-danger)',
                  borderColor: 'rgba(239,68,68,0.3)',
                }}
                title="Xóa từ này"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div style={{ textAlign: 'center' }}>
              <h1 className="text-gradient" style={{ fontSize: '2.25rem', margin: 0 }}>
                {currentSentenceWord?.word}
              </h1>
              <p className="text-muted" style={{ fontSize: '1rem', marginTop: '0.25rem' }}>
                {currentSentenceWord?.phonetic}
              </p>
              <p style={{ color: 'var(--accent-warning)', fontWeight: 600 }}>
                {currentSentenceWord?.viMeaning}
              </p>
              <p className="text-muted" style={{ fontSize: '0.9rem' }}>
                {currentSentenceWord?.meaning}
              </p>
            </div>

            <textarea
              className="input-field"
              value={userSentence}
              onChange={(e) => setUserSentence(e.target.value)}
              placeholder="Nhập câu của bạn..."
              rows={3}
              style={{ resize: 'vertical', fontSize: '1rem', padding: '1rem' }}
            />

            {!aiFeedback && (
              <button
                type="button"
                onClick={handleVerifySentence}
                disabled={!userSentence.trim() || isVerifying}
                className="btn btn-primary"
                style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                {isVerifying ? <Loader2 size={18} className="spin" /> : <Sparkles size={18} />}
                {isVerifying ? 'AI đang kiểm tra...' : 'Nhờ AI kiểm tra'}
              </button>
            )}

            {aiFeedback &&
              (() => {
                const isError =
                  aiFeedback.startsWith('Lỗi') ||
                  aiFeedback.startsWith('Không') ||
                  aiFeedback.includes('Vui lòng vào phần Cài đặt');
                return (
                  <div
                    style={{
                      background: 'rgba(128,128,128,0.06)',
                      padding: '1.25rem',
                      borderRadius: '12px',
                      border: '1px solid var(--glass-border)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.75rem',
                        color: isError ? 'var(--accent-danger)' : 'var(--accent-primary)',
                      }}
                    >
                      <Sparkles size={18} />
                      <h4 style={{ margin: 0, fontSize: '1rem' }}>{isError ? 'Cảnh báo' : 'Nhận xét'}</h4>
                    </div>
                    <MarkdownText text={aiFeedback} />
                    {isError ? (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                        <button
                          type="button"
                          onClick={() => setAiFeedback('')}
                          className="btn btn-primary"
                          style={{ flex: 1, padding: '0.75rem', borderRadius: '8px' }}
                        >
                          Thử lại
                        </button>
                        <button
                          type="button"
                          onClick={handleNextSentence}
                          className="btn btn-outline"
                          style={{ flex: 1, padding: '0.75rem', borderRadius: '8px' }}
                        >
                          Bỏ qua
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleNextSentence}
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: '1rem', padding: '0.75rem', borderRadius: '8px' }}
                      >
                        Tiếp tục
                      </button>
                    )}
                  </div>
                );
              })()}
          </div>
        </div>
      ) : currentWord ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.65rem',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
              }}
            >
              <span>
                Tiến độ: <strong className="text-gradient">{doneCount}</strong> / {sessionTotal}
              </span>
              <span>Còn {queue.length} từ</span>
            </div>
            <div className="session-progress-track">
              <div className="session-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          {isEditing ? (
            <div
              className="glass-panel"
              style={{
                width: '100%',
                maxWidth: '520px',
                margin: '0 auto',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                overflowY: 'auto',
                padding: '1.25rem',
                borderRadius: '16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid var(--glass-border)',
                  paddingBottom: '0.5rem',
                }}
              >
                <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Edit size={16} className="text-gradient" /> Chỉnh sửa thẻ
                </h3>
                <button
                  type="button"
                  onClick={handleAutoLookup}
                  disabled={isAutoLoading || !editWord.trim()}
                  className="btn btn-outline"
                  style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', borderRadius: '6px' }}
                >
                  {isAutoLoading ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />}
                  {isAutoLoading ? 'Đang tra...' : 'Tra cứu'}
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Từ tiếng Anh *
                </label>
                <input className="input-field" value={editWord} onChange={(e) => setEditWord(e.target.value)} />
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Phiên âm</label>
                <input
                  className="input-field"
                  value={editPhonetic}
                  onChange={(e) => setEditPhonetic(e.target.value)}
                />
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Định nghĩa EN
                </label>
                <textarea
                  className="input-field"
                  value={editMeaning}
                  onChange={(e) => setEditMeaning(e.target.value)}
                  rows={2}
                />
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Nghĩa VI</label>
                <input
                  className="input-field"
                  value={editViMeaning}
                  onChange={(e) => setEditViMeaning(e.target.value)}
                />
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Ví dụ</label>
                <textarea
                  className="input-field"
                  value={editExample}
                  onChange={(e) => setEditExample(e.target.value)}
                  rows={2}
                />
                {editError && (
                  <div
                    style={{
                      color: 'var(--accent-danger)',
                      padding: '0.4rem 0.75rem',
                      background: 'rgba(239,68,68,0.1)',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                    }}
                  >
                    {editError}
                  </div>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  borderTop: '1px solid var(--glass-border)',
                  paddingTop: '0.75rem',
                }}
              >
                <button
                  type="button"
                  onClick={(e) => handleDeleteWord(currentWord, e)}
                  className="btn btn-outline"
                  style={{ padding: '0.5rem', borderRadius: '8px', color: 'var(--accent-danger)' }}
                >
                  <Trash2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="btn btn-outline"
                  style={{ flex: 1, padding: '0.5rem', borderRadius: '8px' }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '0.5rem', borderRadius: '8px' }}
                >
                  Lưu
                </button>
              </div>
            </div>
          ) : (
            <div className="flashcard-container" onClick={!isFlipped ? handleFlip : undefined}>
              <div className={`flashcard ${isFlipped ? 'flipped' : ''}`}>
                <div className="flashcard-front">
                  <p
                    className="text-muted"
                    style={{
                      position: 'absolute',
                      top: '1rem',
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      fontSize: '0.65rem',
                    }}
                  >
                    Chạm hoặc Space để lật
                  </p>

                  <div
                    style={{
                      position: 'absolute',
                      top: '1rem',
                      left: '1rem',
                      display: 'flex',
                      gap: '0.25rem',
                      zIndex: 10,
                    }}
                  >
                    <button
                      type="button"
                      onClick={handleStartEdit}
                      className="btn btn-outline"
                      style={{ padding: '0.4rem', borderRadius: '50%', border: 'none', background: 'transparent' }}
                    >
                      <Edit size={18} className="text-muted" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteWord(currentWord, e)}
                      className="btn btn-outline"
                      style={{
                        padding: '0.4rem',
                        borderRadius: '50%',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--accent-danger)',
                      }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div
                    style={{
                      position: 'absolute',
                      top: '2.5rem',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: showReverse ? 'rgba(245, 158, 11, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                      border: showReverse
                        ? '1px solid rgba(245, 158, 11, 0.3)'
                        : '1px solid rgba(59, 130, 246, 0.3)',
                      color: showReverse ? 'var(--accent-warning)' : 'var(--accent-primary)',
                      padding: '0.2rem 0.75rem',
                      borderRadius: '999px',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {showReverse ? 'Đoán từ tiếng Anh' : 'Đoán nghĩa tiếng Việt'}
                  </div>

                  {!showReverse && (
                    <button
                      type="button"
                      onClick={(e) => speakWord(currentWord.word, e)}
                      className="btn btn-outline"
                      style={{
                        position: 'absolute',
                        top: '1rem',
                        right: '1rem',
                        padding: '0.4rem',
                        borderRadius: '50%',
                        border: 'none',
                      }}
                      title="Nghe"
                    >
                      <Volume2 size={20} className="text-muted" />
                    </button>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginTop: '1.5rem',
                      width: '100%',
                    }}
                  >
                    <h1
                      className="word-large text-gradient"
                      style={{
                        marginBottom: 0,
                        fontSize: showReverse ? '2rem' : undefined,
                        wordBreak: 'break-word',
                        lineHeight: 1.2,
                      }}
                    >
                      {showReverse ? formatLineBreaks(currentWord.viMeaning || currentWord.meaning) : currentWord.word}
                    </h1>
                    {!showReverse && currentWord.phonetic && (
                      <p className="text-muted" style={{ fontSize: '1.1rem', fontFamily: 'monospace' }}>
                        {currentWord.phonetic}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flashcard-back">
                  <div
                    style={{
                      position: 'absolute',
                      top: '1rem',
                      left: '1rem',
                      display: 'flex',
                      gap: '0.25rem',
                      zIndex: 10,
                    }}
                  >
                    <button
                      type="button"
                      onClick={handleStartEdit}
                      className="btn btn-outline"
                      style={{ padding: '0.4rem', borderRadius: '50%', border: 'none', background: 'transparent' }}
                    >
                      <Edit size={18} className="text-muted" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteWord(currentWord, e)}
                      className="btn btn-outline"
                      style={{
                        padding: '0.4rem',
                        borderRadius: '50%',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--accent-danger)',
                      }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div
                    style={{
                      position: 'absolute',
                      top: '1rem',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      color: 'var(--accent-success)',
                      padding: '0.15rem 0.6rem',
                      borderRadius: '999px',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                    }}
                  >
                    Đáp án
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.25rem',
                      marginTop: '1.5rem',
                    }}
                  >
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: 0 }}>{currentWord.word}</h1>
                    <button
                      type="button"
                      onClick={(e) => speakWord(currentWord.word, e)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      <Volume2 size={22} />
                    </button>
                  </div>
                  {currentWord.phonetic && (
                    <p className="text-muted" style={{ fontSize: '1rem', fontFamily: 'monospace', marginBottom: '0.5rem' }}>
                      {currentWord.phonetic}
                    </p>
                  )}
                  <div
                    style={{
                      width: 40,
                      height: 3,
                      background: 'var(--accent-primary)',
                      margin: '0.5rem 0',
                      borderRadius: 2,
                    }}
                  />
                  {currentWord.viMeaning && (
                    <p className="preserve-newlines" style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--accent-warning)', marginBottom: '0.25rem' }}>
                      {formatLineBreaks(currentWord.viMeaning)}
                    </p>
                  )}
                  {currentWord.meaning && <p className="word-meaning preserve-newlines">{formatLineBreaks(currentWord.meaning)}</p>}
                  {currentWord.example && <p className="word-example preserve-newlines">&ldquo;{formatLineBreaks(currentWord.example)}&rdquo;</p>}
                </div>
              </div>
            </div>
          )}

          <AnimatePresence>
            {isFlipped && !isEditing && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}
              >
                <button
                  type="button"
                  onClick={() => handleGrade(0)}
                  className="btn btn-outline"
                  style={{ borderColor: 'var(--accent-danger)', color: 'var(--accent-danger)' }}
                >
                  <Frown size={18} /> Quên (1)
                </button>
                <button
                  type="button"
                  onClick={() => handleGrade(3)}
                  className="btn btn-outline"
                  style={{ borderColor: 'var(--accent-success)', color: 'var(--accent-success)' }}
                >
                  <Sparkles size={18} /> Dễ (2)
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
