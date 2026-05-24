import { useState } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { getInitialSRSData } from '../utils/srs';
import { Search, Plus, Loader2, FileSpreadsheet, Zap } from 'lucide-react';
import ImportExcelCSV from './ImportExcelCSV';

const AddWord = ({ words = [], onAdd, onAddWords }) => {
  const [activeAddTab, setActiveAddTab] = useState('manual');
  const [word, setWord] = useState('');
  const [meaning, setMeaning] = useState('');
  const [viMeaning, setViMeaning] = useState('');
  const [example, setExample] = useState('');
  const [quickText, setQuickText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

    for (const currentWord of uniqueWordsToAdd) {
      let finalMeaning = meaning.trim();
      let finalViMeaning = viMeaning.trim();
      let finalExample = example.trim();
      let finalPhonetic = '';

      // Always fetch to try getting phonetic, meaning, and example
      const dictData = await fetchFromDictionary(currentWord);
      if (dictData) {
        if (!finalMeaning) finalMeaning = dictData.fetchedMeaning;
        if (!finalExample) finalExample = dictData.fetchedExample;
        finalPhonetic = dictData.fetchedPhonetic;
      }

      // Translate to Vietnamese if missing
      if (!finalViMeaning) {
        // Try to translate the word itself, or its English meaning
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

      onAdd(newWordObj);
      addedCount++;
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

  const handleQuickAddSubmit = async (e) => {
    e.preventDefault();
    if (!quickText.trim()) return;

    setIsLoading(true);
    setError('');
    setSuccess('');

    const lines = quickText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length === 0) {
      setIsLoading(false);
      return;
    }

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

    if (parsedWords.length === 0) {
      setIsLoading(false);
      return;
    }

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
      setIsLoading(false);
      return;
    }

    try {
      const newWordsList = await Promise.all(uniqueWords.map(async (item) => {
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

      if (onAddWords) {
        onAddWords(newWordsList);
      } else {
        newWordsList.forEach(w => onAdd(w));
      }

      setSuccess(`Đã thêm thành công ${newWordsList.length} từ vựng!`);
      if (duplicates.length > 0) {
        setError(`Bỏ qua ${duplicates.length} từ trùng lặp: ${duplicates.join(', ')}`);
      }
      setQuickText('');
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
        </h2>
        
        <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(0,0,0,0.15)', padding: '0.2rem', borderRadius: '8px' }}>
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
        <form onSubmit={handleQuickAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
      
      <style dangerouslySetInnerHTML={{__html:`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}} />
    </div>
  );
};

export default AddWord;
