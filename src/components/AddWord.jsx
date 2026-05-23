import { useState } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { getInitialSRSData } from '../utils/srs';
import { Search, Plus, Loader2 } from 'lucide-react';

const AddWord = ({ words = [], onAdd }) => {
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
    <div className="glass-panel" style={{ flexShrink: 0 }}>
      <h2 style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
        <Plus size={18} className="text-gradient" /> Add New Word
      </h2>
      
      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <input type="text" className="input-field" value={word} onChange={e => setWord(e.target.value)} placeholder="Word(s) separated by comma *" required />
        <input type="text" className="input-field" value={viMeaning} onChange={e => setViMeaning(e.target.value)} placeholder="Vietnamese (auto if blank)" />
        <input type="text" className="input-field" value={meaning} onChange={e => setMeaning(e.target.value)} placeholder="English definition (auto if blank)" />
        <input type="text" className="input-field" value={example} onChange={e => setExample(e.target.value)} placeholder="Example sentence (optional)" />

        {error && <div style={{ gridColumn: '1/-1', color: 'var(--accent-danger)', padding: '0.4rem 0.75rem', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', fontSize: '0.8rem' }}>{error}</div>}
        {success && <div style={{ gridColumn: '1/-1', color: 'var(--accent-success)', padding: '0.4rem 0.75rem', background: 'rgba(16,185,129,0.1)', borderRadius: '8px', fontSize: '0.8rem' }}>{success}</div>}

        <button type="submit" className="btn btn-primary" disabled={isLoading || !word.trim()} style={{ gridColumn: '1/-1' }}>
          {isLoading ? <Loader2 className="spin" size={16} /> : <Search size={16} />}
          {isLoading ? 'Processing...' : 'Add Word'}
        </button>
      </form>
      
      <style dangerouslySetInnerHTML={{__html:`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}} />
    </div>
  );
};

export default AddWord;
