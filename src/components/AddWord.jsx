import { useState } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { getInitialSRSData } from '../utils/srs';
import { Search, Plus, Loader2, FileSpreadsheet } from 'lucide-react';
import ImportExcelCSV from './ImportExcelCSV';

const AddWord = ({ words = [], onAdd, onAddWords }) => {
  const [activeAddTab, setActiveAddTab] = useState('manual');
  const [word, setWord] = useState('');
  const [meaning, setMeaning] = useState('');
  const [viMeaning, setViMeaning] = useState('');
  const [example, setExample] = useState('');
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

  return (
    <div className="glass-panel" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', margin: 0, fontWeight: 600 }}>
          {activeAddTab === 'manual' ? (
            <>
              <Plus size={16} className="text-gradient" /> Thêm từ mới
            </>
          ) : (
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
      
      {activeAddTab === 'manual' ? (
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
      ) : (
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
