import axios from 'axios';

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'about',
  'is', 'was', 'are', 'were', 'it', 'its', 'as', 'that', 'this', 'from', 'be', 'been', 'being',
  'has', 'have', 'had', 'not', 'but', 'his', 'her', 'their', 'my', 'our', 'your', 'its',
  'more', 'most', 'less', 'least', 'can', 'could', 'would', 'should', 'will', 'all', 'some',
  'any', 'no', 'so', 'than', 'into', 'out', 'up', 'down', 'over', 'after', 'before', 'between',
  'through', 'during', 'without', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
  'where', 'why', 'how', 'both', 'each', 'few', 'other', 'such', 'own', 'same', 'too', 'very',
  'just', 'also', 'did', 'do', 'does', 'get', 'got', 'made', 'make', 'makes', 'making', 'say',
  'says', 'said', 'you', 'they', 'we', 'i', 'he', 'she', 'people', 'person', 'one', 'two',
  'like', 'much', 'many', 'well', 'back', 'even', 'only', 'new', 'now', 'way', 'may', 'might'
]);

/**
 * Fetch top 3 authentic English collocations from Datamuse API (COCA & Google N-Grams corpus)
 */
export const fetchCollocations = async (word) => {
  if (!word || typeof word !== 'string') return [];
  const cleanWord = word.trim().toLowerCase();
  if (!cleanWord) return [];

  try {
    const [jjaRes, jjbRes, bgaRes, bgbRes] = await Promise.all([
      axios.get(`https://api.datamuse.com/words?rel_jja=${encodeURIComponent(cleanWord)}&md=p`).catch(() => ({ data: [] })),
      axios.get(`https://api.datamuse.com/words?rel_jjb=${encodeURIComponent(cleanWord)}&md=p`).catch(() => ({ data: [] })),
      axios.get(`https://api.datamuse.com/words?rel_bga=${encodeURIComponent(cleanWord)}&md=p`).catch(() => ({ data: [] })),
      axios.get(`https://api.datamuse.com/words?rel_bgb=${encodeURIComponent(cleanWord)}&md=p`).catch(() => ({ data: [] })),
    ]);

    const jja = jjaRes.data || [];
    const jjb = jjbRes.data || [];
    const bga = bgaRes.data || [];
    const bgb = bgbRes.data || [];

    const candidates = [];

    // 1. Nouns modified by adjective (e.g. 'lucrative business', 'sustainable agriculture')
    jja.forEach(item => {
      const w = item.word.toLowerCase();
      if (!STOPWORDS.has(w) && w.length > 2 && !w.includes('.') && !w.includes(cleanWord)) {
        candidates.push({ phrase: `${cleanWord} ${item.word}`, score: (item.score || 100) * 1.6 });
      }
    });

    // 2. Adjectives modifying noun (e.g. 'pure serendipity', 'final decision')
    jjb.forEach(item => {
      const w = item.word.toLowerCase();
      if (!STOPWORDS.has(w) && w.length > 2 && !w.includes('.') && !w.includes(cleanWord)) {
        candidates.push({ phrase: `${item.word} ${cleanWord}`, score: (item.score || 100) * 1.6 });
      }
    });

    // 3. Frequent following words / objects / adverbs
    bga.forEach(item => {
      const w = item.word.toLowerCase();
      if (!STOPWORDS.has(w) && w.length > 2 && !w.includes('.') && !w.includes(cleanWord)) {
        candidates.push({ phrase: `${cleanWord} ${item.word}`, score: item.score || 50 });
      }
    });

    // 4. Frequent preceding words / verbs / adverbs
    bgb.forEach(item => {
      const w = item.word.toLowerCase();
      if (!STOPWORDS.has(w) && w.length > 2 && !w.includes('.') && !w.includes(cleanWord)) {
        candidates.push({ phrase: `${item.word} ${cleanWord}`, score: item.score || 50 });
      }
    });

    candidates.sort((a, b) => b.score - a.score);

    const collocations = [];
    const seen = new Set();
    for (const item of candidates) {
      const key = item.phrase.toLowerCase().trim();
      if (!seen.has(key) && collocations.length < 3) {
        seen.add(key);
        collocations.push(item.phrase.trim());
      }
    }

    return collocations;
  } catch (error) {
    console.error('Error fetching collocations for:', word, error);
    return [];
  }
};

/**
 * Translate English text to Vietnamese using Google Translate client API
 */
export const translateToVi = async (text) => {
  if (!text || !text.trim()) return '';
  try {
    const res = await axios.get(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(text.trim())}`
    );
    if (res.data && res.data[0]) {
      return res.data[0].map(item => item[0]).filter(Boolean).join('');
    }
    return '';
  } catch (e) {
    console.error('Translation error:', e);
    return '';
  }
};

/**
 * Fetch 1 authentic example sentence from Tatoeba Open Bilingual Corpus or Free Dictionary API
 */
export const fetchExampleSentence = async (word) => {
  if (!word || typeof word !== 'string') return '';
  const cleanWord = word.trim();
  if (!cleanWord) return '';

  try {
    // 1. Try Tatoeba with direct Vietnamese translation
    const tatoebaViUrl = `https://tatoeba.org/en/api_v0/search?from=eng&to=vie&query=${encodeURIComponent(cleanWord)}`;
    const tatoebaRes = await axios.get(tatoebaViUrl).catch(() => null);
    
    if (tatoebaRes && tatoebaRes.data && tatoebaRes.data.results && tatoebaRes.data.results.length > 0) {
      const match = tatoebaRes.data.results.find(
        r => r.translations && r.translations.some(t => t.length > 0 && t[0].lang === 'vie')
      );
      if (match) {
        const vie = match.translations.flat().find(t => t.lang === 'vie');
        const enSentence = match.text.trim();
        const viSentence = vie ? vie.text.trim() : '';
        return viSentence ? `${enSentence} (${viSentence})` : enSentence;
      }
    }

    // 2. Try Tatoeba English-only search + auto-translate sentence
    const tatoebaEnUrl = `https://tatoeba.org/en/api_v0/search?from=eng&query=${encodeURIComponent(cleanWord)}`;
    const tatoebaEnRes = await axios.get(tatoebaEnUrl).catch(() => null);
    if (tatoebaEnRes && tatoebaEnRes.data && tatoebaEnRes.data.results && tatoebaEnRes.data.results.length > 0) {
      // Find a concise sentence containing the word (between 20 and 150 characters)
      const suitable = tatoebaEnRes.data.results.find(
        r => r.text && r.text.length >= 20 && r.text.length <= 150 && r.text.toLowerCase().includes(cleanWord.toLowerCase())
      ) || tatoebaEnRes.data.results[0];

      if (suitable && suitable.text) {
        const enText = suitable.text.trim();
        const viTrans = await translateToVi(enText);
        return viTrans ? `${enText} (${viTrans})` : enText;
      }
    }

    // 3. Fallback: Try Free Dictionary API
    const dictRes = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`).catch(() => null);
    if (dictRes && dictRes.data && dictRes.data[0] && dictRes.data[0].meanings) {
      for (const meaning of dictRes.data[0].meanings) {
        for (const def of meaning.definitions || []) {
          if (def.example && def.example.trim()) {
            const enEx = def.example.trim();
            const viEx = await translateToVi(enEx);
            return viEx ? `${enEx} (${viEx})` : enEx;
          }
        }
      }
    }

    return '';
  } catch (error) {
    console.error('Error fetching example sentence for:', word, error);
    return '';
  }
};

/**
 * Fetch phonetic and English definition from Free Dictionary API
 */
export const fetchDictionaryDetails = async (word) => {
  if (!word) return { phonetic: '', meaning: '', example: '' };
  try {
    const res = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.trim())}`);
    const data = res.data[0];
    if (!data) return { phonetic: '', meaning: '', example: '' };

    let phonetic = data.phonetic || '';
    if (!phonetic && data.phonetics) {
      const p = data.phonetics.find(ph => ph.text);
      if (p) phonetic = p.text;
    }

    let meaning = '';
    let example = '';
    if (data.meanings && data.meanings.length > 0) {
      meaning = data.meanings[0].definitions[0]?.definition || '';
      for (const m of data.meanings) {
        for (const def of m.definitions || []) {
          if (def.example && !example) {
            example = def.example;
          }
        }
      }
    }

    return { phonetic, meaning, example };
  } catch {
    return { phonetic: '', meaning: '', example: '' };
  }
};

/**
 * Fetch all missing information for a single word
 */
export const enrichSingleWord = async (wordObj, options = {}) => {
  const {
    fillCollocations = true,
    fillExample = true,
    fillMeaning = true,
    fillViMeaning = true,
    fillPhonetic = true,
    forceOverwrite = false
  } = options;

  const currentWord = wordObj.word ? wordObj.word.trim() : '';
  if (!currentWord) return wordObj;

  const result = { ...wordObj };

  // 1. Collocations
  const needCollocations = fillCollocations && (forceOverwrite || !result.collocations || result.collocations.length === 0);
  let collocationsPromise = Promise.resolve(result.collocations || []);
  if (needCollocations) {
    collocationsPromise = fetchCollocations(currentWord);
  }

  // 2. Dictionary details (Phonetic & Definition)
  const needDict = (fillPhonetic && (!result.phonetic || forceOverwrite)) || 
                   (fillMeaning && (!result.meaning || forceOverwrite));
  let dictPromise = Promise.resolve({ phonetic: result.phonetic || '', meaning: result.meaning || '', example: '' });
  if (needDict) {
    dictPromise = fetchDictionaryDetails(currentWord);
  }

  // 3. Vietnamese meaning
  const needViMeaning = fillViMeaning && (forceOverwrite || !result.viMeaning);
  let viMeaningPromise = Promise.resolve(result.viMeaning || '');
  if (needViMeaning) {
    viMeaningPromise = translateToVi(currentWord);
  }

  // 4. Example sentence
  const needExample = fillExample && (forceOverwrite || !result.example);
  let examplePromise = Promise.resolve(result.example || '');
  if (needExample) {
    examplePromise = fetchExampleSentence(currentWord);
  }

  const [cols, dictData, viM, ex] = await Promise.all([
    collocationsPromise,
    dictPromise,
    viMeaningPromise,
    examplePromise
  ]);

  if (needCollocations && cols && cols.length > 0) {
    result.collocations = cols;
  }
  if (needDict && dictData) {
    if (fillPhonetic && dictData.phonetic && (!result.phonetic || forceOverwrite)) {
      result.phonetic = dictData.phonetic;
    }
    if (fillMeaning && dictData.meaning && (!result.meaning || forceOverwrite)) {
      result.meaning = dictData.meaning;
    }
  }
  if (needViMeaning && viM && (!result.viMeaning || forceOverwrite)) {
    result.viMeaning = viM;
  }
  if (needExample && ex && (!result.example || forceOverwrite)) {
    result.example = ex;
  }

  return result;
};

/**
 * Batch enrichment worker with concurrency control and live progress callback
 */
export const enrichWordsBatch = async (wordsToEnrich, options = {}, onProgress, isCancelledRef) => {
  if (!wordsToEnrich || wordsToEnrich.length === 0) return [];

  const concurrency = options.concurrency || 3;
  const results = [...wordsToEnrich];
  let completed = 0;
  const total = wordsToEnrich.length;

  let cursor = 0;

  const worker = async () => {
    while (cursor < total) {
      if (isCancelledRef && isCancelledRef.current) break;
      const index = cursor++;
      const wordItem = wordsToEnrich[index];

      try {
        if (onProgress) {
          onProgress({
            current: completed + 1,
            total,
            activeWord: wordItem.word,
            percent: Math.round(((completed) / total) * 100)
          });
        }

        const enriched = await enrichSingleWord(wordItem, options);
        results[index] = enriched;
      } catch (err) {
        console.error('Error enriching word in batch:', wordItem.word, err);
      } finally {
        completed++;
        if (onProgress) {
          onProgress({
            current: completed,
            total,
            activeWord: wordItem.word,
            percent: Math.round((completed / total) * 100)
          });
        }
      }

      // Small throttle to stay well within rate limits
      await new Promise(r => setTimeout(r, 60));
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
  await Promise.all(workers);

  return results;
};
