import { useState } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { getInitialSRSData } from '../utils/srs';
import { Search, Plus, Loader2, FileSpreadsheet, Zap, Bot } from 'lucide-react';
import ImportExcelCSV from './ImportExcelCSV';
import { autoTagWords } from '../utils/aiTagger';

const AddWord = ({ words = [], settings, topics = [], addTopic, onUpdateWord, onAdd, onAddWords }) => {
  const [activeAddTab, setActiveAddTab] = useState('manual');
  const [word, setWord] = useState('');
  const [meaning, setMeaning] = useState('');
  const [viMeaning, setViMeaning] = useState('');
  const [example, setExample] = useState('');
  const [quickText, setQuickText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reviewWordsList, setReviewWordsList] = useState(null);
  const [reviewDuplicates, setReviewDuplicates] = useState([]);
  const [isAutoTagging, setIsAutoTagging] = useState(false);
  const [tagProgress, setTagProgress] = useState(0);
  const [tagTotal, setTagTotal] = useState(0);
  const [pendingTagSuggestions, setPendingTagSuggestions] = useState(null);
  const [tagDecisions, setTagDecisions] = useState({});

  const handleSaveTagDecisions = () => {
    const newWords = [];
    const updatedWords = [];
    
    pendingTagSuggestions.forEach((item, index) => {
      const decision = tagDecisions[index] || 'new'; // Mặc định tạo tag mới nếu không chọn gì
      let finalTags = [];
      if (decision === 'new' && item.aiTag.suggestedNewTag) {
        finalTags = [item.aiTag.suggestedNewTag];
        if (addTopic) addTopic(item.aiTag.suggestedNewTag);
      } else if (decision === 'existing' && item.aiTag.bestExistingTag) {
        finalTags = [item.aiTag.bestExistingTag];
      }

      const finalWord = {
        ...item.wordObj,
        tags: finalTags,
        wordType: item.aiTag.wordType || ''
      };

      if (item.isUpdate) {
        updatedWords.push(finalWord);
      } else {
        newWords.push(finalWord);
      }
    });

    if (updatedWords.length > 0) {
      updatedWords.forEach(w => onUpdateWord(w));
    }
    if (newWords.length > 0) {
      if (onAddWords && newWords.length > 1) {
        onAddWords(newWords);
      } else {
        newWords.forEach(w => onAdd(w));
      }
    }

    setSuccess(`Đã áp dụng và lưu ${pendingTagSuggestions.length} từ vựng!`);
    setTimeout(() => setSuccess(''), 3000);
    setPendingTagSuggestions(null);
    setTagDecisions({});
  };


  const handleAutoTagAll = async () => {
    if (!settings?.geminiApiKey) {
      setError('Vui lòng nhập Gemini API Key trong phần Settings trước khi sử dụng tính năng này.');
      return;
    }
    const wordsToTag = words.filter(w => !w.wordType || !w.tags || w.tags.length === 0);
    if (wordsToTag.length === 0) {
      setSuccess('Tuyệt vời! Tất cả từ vựng trong thư viện của bạn đều đã có Tag và Từ loại.');
      return;
    }

    if (!window.confirm(`Tìm thấy ${wordsToTag.length} từ vựng chưa có Tag. Quá trình này sẽ gọi AI và mất vài phút, bạn có muốn bắt đầu không?`)) return;

    setIsAutoTagging(true);
    setError('');
    setSuccess('');
    setTagTotal(wordsToTag.length);
    setTagProgress(0);

    const BATCH_SIZE = 15;
    let successCount = 0;
    let allSuggestions = [];

    for (let i = 0; i < wordsToTag.length; i += BATCH_SIZE) {
      const batch = wordsToTag.slice(i, i + BATCH_SIZE);
      try {
        const aiTags = await autoTagWords(batch, settings.geminiApiKey, topics, settings.geminiModel);
        aiTags.forEach(t => {
          const match = batch.find(w => w.word.toLowerCase() === t.word.toLowerCase());
          if (match) {
            if (t.suggestedNewTag) {
              allSuggestions.push({ wordObj: match, aiTag: t, isUpdate: true });
            } else {
              onUpdateWord({
                ...match,
                tags: t.tags || [],
                wordType: t.wordType || ''
              });
              successCount++;
            }
          }
        });
      } catch (err) {
        console.error("Batch auto-tag error:", err);
      }
      setTagProgress(Math.min(i + BATCH_SIZE, wordsToTag.length));
    }

    setIsAutoTagging(false);
    
    if (allSuggestions.length > 0) {
      setPendingTagSuggestions(allSuggestions);
      // Initialize decisions to 'new'
      const initDecisions = {};
      allSuggestions.forEach((_, idx) => initDecisions[idx] = 'new');
      setTagDecisions(initDecisions);
    }

    setSuccess(`Đã cập nhật tag cho ${successCount} từ vựng!${allSuggestions.length > 0 ? ` Có ${allSuggestions.length} đề xuất tag mới cần bạn duyệt.` : ''}`);
    setTimeout(() => setSuccess(''), 5000);
  };


  const translateToVi = async (text) => {
    try {
      const res = await axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(text)}`);
      return res.data[0][0][0];
    } catch (e) {
      console.error("Translation error", e);
      return "";
    }
  };

  const fetchFromDictionary = async (searchWord) => {
    try {
      const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${searchWord}`);
      const data = response.data[0];
      
      let fetchedMeaning = '';
      let fetchedExample = '';
      let fetchedPhonetic = data.phonetic || '';

      if (!fetchedPhonetic && data.phonetics) {
        const p = data.phonetics.find(ph => ph.text);
        if (p) fetchedPhonetic = p.text;
      }

      if (data.meanings && data.meanings.length > 0) {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!word.trim()) return;

    setIsLoading(true);
    setError('');
    setSuccess('');

    const wordsToAdd = word.split(',').map(w => w.trim()).filter(w => w !== '');
    
    if (wordsToAdd.length === 0) {
      setIsLoading(false);
      return;
    }

    const duplicates = [];
    const uniqueWordsToAdd = [];

    for (const w of wordsToAdd) {
      const isDuplicate = words.some(existingWord => 
        existingWord.word.trim().toLowerCase() === w.toLowerCase()
      );
      const isAlreadyInUniqueList = uniqueWordsToAdd.some(uniqueW => 
        uniqueW.toLowerCase() === w.toLowerCase()
      );

      if (isDuplicate || isAlreadyInUniqueList) {
        duplicates.push(w);
      } else {
        uniqueWordsToAdd.push(w);
      }
    }

    if (duplicates.length > 0 && uniqueWordsToAdd.length === 0) {
      setError(
        duplicates.length === 1 
          ? `Word "${duplicates[0]}" already exists in your library!` 
          : `Words already exist: ${duplicates.map(d => `"${d}"`).join(', ')}`
      );
      setIsLoading(false);
      return;
    }

    let addedCount = 0;
    const finalWordsToSave = [];
    const pendingSugg = [];

    for (const currentWord of uniqueWordsToAdd) {
      let finalMeaning = meaning.trim();
      let finalViMeaning = viMeaning.trim();
      let finalExample = example.trim();
      let finalPhonetic = '';

      const dictData = await fetchFromDictionary(currentWord);
      if (dictData) {
        if (!finalMeaning) finalMeaning = dictData.fetchedMeaning;
        if (!finalExample) finalExample = dictData.fetchedExample;
        finalPhonetic = dictData.fetchedPhonetic;
      }

      if (!finalViMeaning) {
        finalViMeaning = await translateToVi(currentWord);
      }

      const newWordObj = {
        id: uuidv4(),
        word: currentWord,
        phonetic: finalPhonetic,
        meaning: finalMeaning,
        viMeaning: finalViMeaning,
        example: finalExample,
        ...getInitialSRSData(),
        dateAdded: new Date().getTime()
      };

      finalWordsToSave.push(newWordObj);
    }

    if (settings?.geminiApiKey && finalWordsToSave.length > 0) {
      try {
        const aiTags = await autoTagWords(finalWordsToSave, settings.geminiApiKey, topics, settings.geminiModel);
        aiTags.forEach(t => {
          const match = finalWordsToSave.find(w => w.word.toLowerCase() === t.word.toLowerCase());
          if (match) {
            if (t.suggestedNewTag) {
              pendingSugg.push({ wordObj: match, aiTag: t, isUpdate: false });
            } else {
              match.tags = t.tags || [];
              match.wordType = t.wordType || '';
            }
          }
        });
      } catch (err) {
        console.error("Auto tag error:", err);
      }
    }

    const wordsWithoutSugg = finalWordsToSave.filter(w => !pendingSugg.some(s => s.wordObj.id === w.id));
    wordsWithoutSugg.forEach(w => onAdd(w));
    addedCount = wordsWithoutSugg.length;

    if (pendingSugg.length > 0) {
      setPendingTagSuggestions(pendingSugg);
      const initDecisions = {};
      pendingSugg.forEach((_, idx) => initDecisions[idx] = 'new');
      setTagDecisions(initDecisions);
    }

    
    if (uniqueWordsToAdd.length === 1) {
      setSuccess(`Successfully added "${uniqueWordsToAdd[0]}"!`);
    } else {
      setSuccess(`Successfully added ${addedCount} words!`);
    }

    if (duplicates.length > 0) {
      setError(`Skipped duplicate word(s): ${duplicates.map(d => `"${d}"`).join(', ')}`);
    }
    
    setWord('');
    setMeaning('');
    setViMeaning('');
    setExample('');
    setIsLoading(false);
    
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleQuickAddReview = (e) => {
    e.preventDefault();
    if (!quickText.trim()) return;

    setError('');
    setSuccess('');

    const lines = quickText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length === 0) return;

    const parsedWords = [];
    for (const line of lines) {
      const parts = line.split(':');
      let w = '';
      let translation = '';
      let ex = '';

      if (parts.length >= 3) {
        w = parts[0].trim();
        translation = parts[1].trim();
        ex = parts.slice(2).join(':').trim();
      } else if (parts.length === 2) {
        w = parts[0].trim();
        translation = parts[1].trim();
      } else {
        w = parts[0].trim();
      }

      if (w) {
        parsedWords.push({ word: w, viMeaning: translation, example: ex });
      }
    }

    if (parsedWords.length === 0) return;

    const duplicates = [];
    const uniqueWords = [];

    for (const item of parsedWords) {
      const isDuplicate = words.some(existingWord => 
        existingWord.word.trim().toLowerCase() === item.word.toLowerCase()
      );
      const isAlreadyInUniqueList = uniqueWords.some(uniqueW => 
        uniqueW.word.toLowerCase() === item.word.toLowerCase()
      );

      if (isDuplicate || isAlreadyInUniqueList) {
        duplicates.push(item.word);
      } else {
        uniqueWords.push(item);
      }
    }

    if (duplicates.length > 0 && uniqueWords.length === 0) {
      setError(
        duplicates.length === 1 
          ? `Từ "${duplicates[0]}" đã tồn tại trong thư viện!` 
          : `Các từ đã tồn tại: ${duplicates.map(d => `"${d}"`).join(', ')}`
      );
      return;
    }

    setReviewWordsList(uniqueWords);
    setReviewDuplicates(duplicates);
  };

  const confirmQuickAdd = async () => {
    if (!reviewWordsList || reviewWordsList.length === 0) return;
    
    setIsLoading(true);
    try {
      const newWordsList = await Promise.all(reviewWordsList.map(async (item) => {
        let finalMeaning = '';
        let finalViMeaning = item.viMeaning;
        let finalExample = item.example || '';
        let finalPhonetic = '';

        const dictData = await fetchFromDictionary(item.word);
        if (dictData) {
          finalMeaning = dictData.fetchedMeaning;
          if (!finalExample) {
            finalExample = dictData.fetchedExample;
          }
          finalPhonetic = dictData.fetchedPhonetic;
        }

        if (!finalViMeaning) {
          finalViMeaning = await translateToVi(item.word);
        }

        return {
          id: uuidv4(),
          word: item.word,
          phonetic: finalPhonetic,
          meaning: finalMeaning,
          viMeaning: finalViMeaning,
          example: finalExample,
          ...getInitialSRSData(),
          dateAdded: new Date().getTime()
        };
      }));

      let pendingSugg = [];

      if (settings?.geminiApiKey && newWordsList.length > 0) {
        try {
          const aiTags = await autoTagWords(newWordsList, settings.geminiApiKey, topics, settings.geminiModel);
          aiTags.forEach(t => {
            const match = newWordsList.find(w => w.word.toLowerCase() === t.word.toLowerCase());
            if (match) {
              if (t.suggestedNewTag) {
                pendingSugg.push({ wordObj: match, aiTag: t, isUpdate: false });
              } else {
                match.tags = t.tags || [];
                match.wordType = t.wordType || '';
              }
            }
          });
        } catch (err) {
          console.error("Auto tag error:", err);
        }
      }

      const wordsWithoutSugg = newWordsList.filter(w => !pendingSugg.some(s => s.wordObj.id === w.id));

      if (onAddWords && wordsWithoutSugg.length > 1) {
        onAddWords(wordsWithoutSugg);
      } else {
        wordsWithoutSugg.forEach(w => onAdd(w));
      }

      if (pendingSugg.length > 0) {
        setPendingTagSuggestions(pendingSugg);
        const initDecisions = {};
        pendingSugg.forEach((_, idx) => initDecisions[idx] = 'new');
        setTagDecisions(initDecisions);
      }

      setSuccess(`Đã thêm thành công ${newWordsList.length} từ vựng!`);
      if (reviewDuplicates.length > 0) {
        setError(`Bỏ qua ${reviewDuplicates.length} từ trùng lặp: ${reviewDuplicates.join(', ')}`);
      }
      setQuickText('');
      setReviewWordsList(null);
      setReviewDuplicates([]);
    } catch (err) {
      console.error(err);
      setError('Đã xảy ra lỗi khi thêm từ vựng. Vui lòng thử lại!');
    } finally {
      setIsLoading(false);
      setTimeout(() => setSuccess(''), 4000);
    }
  };

  return (
    <div className="glass-panel" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', margin: 0, fontWeight: 600 }}>
          {activeAddTab === 'manual' && (
            <>
              <Plus size={16} className="text-gradient" /> Thêm từ mới
            </>
          )}
          {activeAddTab === 'quick' && (
            <>
              <Zap size={16} className="text-gradient" /> Thêm nhanh (từ: dịch: câu ví dụ)
            </>
          )}
          {activeAddTab === 'upload' && (
            <>
              <FileSpreadsheet size={16} className="text-gradient" /> Nhập từ Excel / CSV
            </>
          )}
          {activeAddTab === 'autotag' && (
            <>
              <Bot size={16} className="text-gradient" /> AI Auto-Tagging
            </>
          )}
        </h2>
        
        <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(0,0,0,0.15)', padding: '0.2rem', borderRadius: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveAddTab('manual')}
            style={{
              border: 'none',
              background: activeAddTab === 'manual' ? 'var(--glass-bg)' : 'transparent',
              color: activeAddTab === 'manual' ? 'var(--text-main)' : 'var(--text-muted)',
              padding: '0.25rem 0.6rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              transition: 'all 0.2s ease'
            }}
          >
            <Plus size={11} />
            Thêm thủ công
          </button>
          
          <button
            type="button"
            onClick={() => setActiveAddTab('quick')}
            style={{
              border: 'none',
              background: activeAddTab === 'quick' ? 'var(--glass-bg)' : 'transparent',
              color: activeAddTab === 'quick' ? 'var(--text-main)' : 'var(--text-muted)',
              padding: '0.25rem 0.6rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              transition: 'all 0.2s ease'
            }}
          >
            <Zap size={11} />
            Thêm nhanh
          </button>
          
          <button
            type="button"
            onClick={() => setActiveAddTab('upload')}
            style={{
              border: 'none',
              background: activeAddTab === 'upload' ? 'var(--glass-bg)' : 'transparent',
              color: activeAddTab === 'upload' ? 'var(--text-main)' : 'var(--text-muted)',
              padding: '0.25rem 0.6rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              transition: 'all 0.2s ease'
            }}
          >
            <FileSpreadsheet size={11} />
            Nhập Excel / CSV
          </button>
          
          <button
            type="button"
            onClick={() => setActiveAddTab('autotag')}
            style={{
              border: 'none',
              background: activeAddTab === 'autotag' ? 'var(--glass-bg)' : 'transparent',
              color: activeAddTab === 'autotag' ? 'var(--text-main)' : 'var(--text-muted)',
              padding: '0.25rem 0.6rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              transition: 'all 0.2s ease'
            }}
          >
            <Bot size={11} />
            Auto-Tag Tất cả
          </button>
        </div>
      </div>
      
      {activeAddTab === 'manual' && (
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <input type="text" className="input-field" value={word} onChange={e => setWord(e.target.value)} placeholder="Từ vựng (phân tách bằng dấu phẩy nếu thêm nhiều từ) *" required />
          <input type="text" className="input-field" value={viMeaning} onChange={e => setViMeaning(e.target.value)} placeholder="Nghĩa tiếng Việt (tự dịch nếu để trống)" />
          <input type="text" className="input-field" value={meaning} onChange={e => setMeaning(e.target.value)} placeholder="Định nghĩa tiếng Anh (tự tra cứu nếu để trống)" />
          <input type="text" className="input-field" value={example} onChange={e => setExample(e.target.value)} placeholder="Ví dụ đặt câu (tùy chọn)" />

          {error && <div style={{ gridColumn: '1/-1', color: 'var(--accent-danger)', padding: '0.4rem 0.75rem', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', fontSize: '0.8rem' }}>{error}</div>}
          {success && <div style={{ gridColumn: '1/-1', color: 'var(--accent-success)', padding: '0.4rem 0.75rem', background: 'rgba(16,185,129,0.1)', borderRadius: '8px', fontSize: '0.8rem' }}>{success}</div>}

          <button type="submit" className="btn btn-primary" disabled={isLoading || !word.trim()} style={{ gridColumn: '1/-1' }}>
            {isLoading ? <Loader2 className="spin" size={16} /> : <Search size={16} />}
            {isLoading ? 'Đang xử lý...' : 'Thêm từ vựng'}
          </button>
        </form>
      )}

      {activeAddTab === 'quick' && (
        <form onSubmit={handleQuickAddReview} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <textarea
              className="input-field"
              value={quickText}
              onChange={e => setQuickText(e.target.value)}
              placeholder="Nhập từ vựng định dạng 'từ: dịch: câu ví dụ' (mỗi từ một dòng)&#10;Ví dụ:&#10;hello: xin chào: Hello, how are you?&#10;apple: quả táo: I eat an apple every day&#10;beautiful: xinh đẹp&#10;championship (để trống dịch và ví dụ nếu muốn tự động tra cứu)"
              rows={5}
              style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.4' }}
              required
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              * Có thể bỏ trống phần dịch hoặc câu ví dụ (hệ thống sẽ tự động dịch hoặc lấy câu ví dụ nếu có).
            </span>
          </div>

          {error && <div style={{ color: 'var(--accent-danger)', padding: '0.4rem 0.75rem', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', fontSize: '0.8rem' }}>{error}</div>}
          {success && <div style={{ color: 'var(--accent-success)', padding: '0.4rem 0.75rem', background: 'rgba(16,185,129,0.1)', borderRadius: '8px', fontSize: '0.8rem' }}>{success}</div>}

          <button type="submit" className="btn btn-primary" disabled={isLoading || !quickText.trim()}>
            {isLoading ? <Loader2 className="spin" size={16} /> : <Zap size={16} />}
            {isLoading ? 'Đang xử lý...' : 'Thêm nhanh từ vựng'}
          </button>
        </form>
      )}

      {activeAddTab === 'upload' && (
        <ImportExcelCSV words={words} onAdd={onAdd} onAddWords={onAddWords} onCloseTab={() => setActiveAddTab('manual')} />
      )}

      {activeAddTab === 'autotag' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Tính năng này sẽ sử dụng AI để tự động phân tích và gắn Chủ đề, Từ loại cho tất cả các từ vựng <strong>hiện đang trống tag</strong> trong thư viện của bạn. Bạn cần nhập Gemini API Key trong phần Settings để sử dụng.
          </p>
          
          {error && <div style={{ color: 'var(--accent-danger)', padding: '0.4rem 0.75rem', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', fontSize: '0.8rem' }}>{error}</div>}
          {success && <div style={{ color: 'var(--accent-success)', padding: '0.4rem 0.75rem', background: 'rgba(16,185,129,0.1)', borderRadius: '8px', fontSize: '0.8rem' }}>{success}</div>}
          
          {isAutoTagging && tagTotal > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>Đang phân tích...</span>
                <span>{tagProgress} / {tagTotal}</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${(tagProgress / tagTotal) * 100}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))', transition: 'width 0.3s ease' }}></div>
              </div>
            </div>
          )}

          <button onClick={handleAutoTagAll} disabled={isAutoTagging} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
            {isAutoTagging ? <Loader2 className="spin" size={16} /> : <Bot size={16} />}
            {isAutoTagging ? 'Đang tự động gắn Tag...' : 'Bắt đầu gắn Tag hàng loạt'}
          </button>
        </div>
      )}

      
      {reviewWordsList && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: '1rem', overflowY: 'auto' }}>
          <div style={{ width: '100%', maxWidth: '600px', maxHeight: 'calc(100vh - 2rem)', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--bg-dark)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap size={20} className="text-gradient" /> Kiểm tra lại từ vựng
            </h3>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Hệ thống đã nhận diện được <strong>{reviewWordsList.length}</strong> từ vựng mới. Bạn vui lòng kiểm tra lại xem định dạng đã đúng chưa.
            </p>

            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.5rem', background: 'var(--bg-darker)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}>
                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Từ vựng</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Nghĩa (Tùy chọn)</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Ví dụ (Tùy chọn)</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewWordsList.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.5rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{item.word}</td>
                      <td style={{ padding: '0.5rem' }}>{item.viMeaning || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Tự động dịch</span>}</td>
                      <td style={{ padding: '0.5rem' }}>{item.example || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Tự động lấy</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {reviewDuplicates.length > 0 && (
              <div style={{ color: 'var(--accent-warning)', fontSize: '0.8rem', padding: '0.5rem', background: 'rgba(245,158,11,0.1)', borderRadius: '8px' }}>
                <strong>Lưu ý:</strong> Sẽ bỏ qua {reviewDuplicates.length} từ đã tồn tại ({reviewDuplicates.join(', ')}).
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem', flexShrink: 0 }}>
              <button onClick={() => setReviewWordsList(null)} type="button" className="btn btn-outline" style={{ padding: '0.5rem 1rem', borderRadius: '8px' }} disabled={isLoading}>
                Hủy bỏ
              </button>
              <button onClick={confirmQuickAdd} type="button" className="btn btn-primary" style={{ padding: '0.5rem 1rem', borderRadius: '8px' }} disabled={isLoading}>
                {isLoading ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
                {isLoading ? 'Đang thêm...' : 'Xác nhận thêm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingTagSuggestions && pendingTagSuggestions.length > 0 && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: '1rem', overflowY: 'auto' }}>
          <div style={{ width: '100%', maxWidth: '700px', maxHeight: 'calc(100vh - 2rem)', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--bg-dark)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bot size={20} className="text-gradient" /> Đề xuất Tag Mới từ AI
            </h3>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              AI phát hiện <strong>{pendingTagSuggestions.length}</strong> từ vựng không có tag nào phù hợp trong danh sách hiện tại. Bạn vui lòng xem xét các đề xuất dưới đây:
            </p>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {pendingTagSuggestions.map((item, idx) => (
                <div key={idx} className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--accent-primary)' }}>{item.wordObj.word}</h4>
                    <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', color: 'var(--text-muted)' }}>{item.aiTag.wordType}</span>
                  </div>
                  
                  {item.wordObj.viMeaning && <p style={{ fontSize: '0.85rem', color: 'var(--accent-warning)', margin: 0 }}>{item.wordObj.viMeaning}</p>}
                  {item.aiTag.reasoning && <p style={{ fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-muted)', margin: '0.25rem 0' }}>💡 Lý do: {item.aiTag.reasoning}</p>}
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <label style={{
                      display: 'flex', gap: '0.5rem', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer',
                      border: tagDecisions[idx] === 'new' ? '1px solid var(--accent-success)' : '1px solid var(--glass-border)',
                      background: tagDecisions[idx] === 'new' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                      transition: 'all 0.2s ease'
                    }}>
                      <input type="radio" name={`tag-decision-${idx}`} value="new" checked={tagDecisions[idx] === 'new'} onChange={() => setTagDecisions(prev => ({...prev, [idx]: 'new'}))} />
                      <div style={{ fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--accent-success)', fontWeight: 600 }}>Tạo Tag Mới:</span><br/>
                        {item.aiTag.suggestedNewTag}
                      </div>
                    </label>

                    <label style={{
                      display: 'flex', gap: '0.5rem', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer',
                      border: tagDecisions[idx] === 'existing' ? '1px solid var(--accent-secondary)' : '1px solid var(--glass-border)',
                      background: tagDecisions[idx] === 'existing' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                      transition: 'all 0.2s ease'
                    }}>
                      <input type="radio" name={`tag-decision-${idx}`} value="existing" checked={tagDecisions[idx] === 'existing'} onChange={() => setTagDecisions(prev => ({...prev, [idx]: 'existing'}))} />
                      <div style={{ fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>Dùng Tag Gần Nhất:</span><br/>
                        {item.aiTag.bestExistingTag || 'Không có'}
                      </div>
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem', flexShrink: 0 }}>
              <button onClick={() => setPendingTagSuggestions(null)} type="button" className="btn btn-outline" style={{ padding: '0.5rem 1rem', borderRadius: '8px' }}>
                Hủy bỏ
              </button>
              <button onClick={handleSaveTagDecisions} type="button" className="btn btn-primary" style={{ padding: '0.5rem 1rem', borderRadius: '8px' }}>
                <Plus size={16} /> Lưu Lựa chọn
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html:`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}} />
    </div>
  );
};

export default AddWord;
