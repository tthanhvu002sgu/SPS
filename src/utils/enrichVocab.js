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

const API_TIMEOUT_MS = 2800; // 2.8s timeout per request to prevent hanging workers

/**
 * Fetch top 3 authentic English collocations from Datamuse API (COCA & Google N-Grams corpus)
 * Uses max=8 for ultra-fast response times & lightweight JSON payload
 */
export const fetchCollocations = async (word) => {
  if (!word || typeof word !== 'string') return [];
  const cleanWord = word.trim().toLowerCase();
  if (!cleanWord) return [];

  try {
    const [jjaRes, jjbRes, bgaRes, bgbRes] = await Promise.all([
      axios.get(`https://api.datamuse.com/words?rel_jja=${encodeURIComponent(cleanWord)}&max=8&md=p`, { timeout: API_TIMEOUT_MS }).catch(() => ({ data: [] })),
      axios.get(`https://api.datamuse.com/words?rel_jjb=${encodeURIComponent(cleanWord)}&max=8&md=p`, { timeout: API_TIMEOUT_MS }).catch(() => ({ data: [] })),
      axios.get(`https://api.datamuse.com/words?rel_bga=${encodeURIComponent(cleanWord)}&max=8&md=p`, { timeout: API_TIMEOUT_MS }).catch(() => ({ data: [] })),
      axios.get(`https://api.datamuse.com/words?rel_bgb=${encodeURIComponent(cleanWord)}&max=8&md=p`, { timeout: API_TIMEOUT_MS }).catch(() => ({ data: [] })),
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
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(text.trim())}`,
      { timeout: API_TIMEOUT_MS }
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
export const fetchExampleSentence = async (word, existingExample = '') => {
  if (!word || typeof word !== 'string') return '';
  const cleanWord = word.trim();
  if (!cleanWord) return '';

  try {
    // 1. If we already got an English example sentence (e.g. from Dictionary API), translate it directly
    if (existingExample && existingExample.trim()) {
      const viEx = await translateToVi(existingExample.trim());
      return viEx ? `${existingExample.trim()} (${viEx})` : existingExample.trim();
    }

    // 2. Try Tatoeba English search + auto-translate
    const tatoebaEnUrl = `https://tatoeba.org/en/api_v0/search?from=eng&query=${encodeURIComponent(cleanWord)}`;
    const tatoebaEnRes = await axios.get(tatoebaEnUrl, { timeout: API_TIMEOUT_MS }).catch(() => null);
    if (tatoebaEnRes && tatoebaEnRes.data && tatoebaEnRes.data.results && tatoebaEnRes.data.results.length > 0) {
      const suitable = tatoebaEnRes.data.results.find(
        r => r.text && r.text.length >= 20 && r.text.length <= 140 && r.text.toLowerCase().includes(cleanWord.toLowerCase())
      ) || tatoebaEnRes.data.results[0];

      if (suitable && suitable.text) {
        const enText = suitable.text.trim();
        const viTrans = await translateToVi(enText);
        return viTrans ? `${enText} (${viTrans})` : enText;
      }
    }

    // 3. Fallback: Try Free Dictionary API
    const dictRes = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`, { timeout: API_TIMEOUT_MS }).catch(() => null);
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
 * Fetch phonetic, English definition and example sentence from Free Dictionary API in a single request
 */
export const fetchDictionaryDetails = async (word) => {
  if (!word) return { phonetic: '', meaning: '', example: '' };
  try {
    const res = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.trim())}`, { timeout: API_TIMEOUT_MS });
    const data = res.data && res.data[0];
    if (!data) return { phonetic: '', meaning: '', example: '' };

    let phonetic = data.phonetic || '';
    if (!phonetic && data.phonetics) {
      const p = data.phonetics.find(ph => ph.text);
      if (p) phonetic = p.text;
    }

    let meaning = '';
    let example = '';
    if (data.meanings && data.meanings.length > 0) {
      meaning = data.meanings[0].definitions?.[0]?.definition || '';
      for (const m of data.meanings) {
        for (const def of m.definitions || []) {
          if (def.example && !example) {
            example = def.example.trim();
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
 * Fetch all missing information for a single word using an optimized parallel pipeline
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
  const collocationsPromise = needCollocations
    ? fetchCollocations(currentWord)
    : Promise.resolve(result.collocations || []);

  // 2. Dictionary details (Phonetic, Meaning, and Example candidate in 1 request)
  const needPhonetic = fillPhonetic && (!result.phonetic || forceOverwrite);
  const needMeaning = fillMeaning && (!result.meaning || forceOverwrite);
  const needExample = fillExample && (!result.example || forceOverwrite);
  const needDict = needPhonetic || needMeaning || needExample;

  const dictPromise = needDict
    ? fetchDictionaryDetails(currentWord)
    : Promise.resolve({ phonetic: result.phonetic || '', meaning: result.meaning || '', example: '' });

  // 3. Vietnamese meaning
  const needViMeaning = fillViMeaning && (forceOverwrite || !result.viMeaning);
  const viMeaningPromise = needViMeaning
    ? translateToVi(currentWord)
    : Promise.resolve(result.viMeaning || '');

  // Execute primary requests in parallel
  const [cols, dictData, viM] = await Promise.all([
    collocationsPromise,
    dictPromise,
    viMeaningPromise
  ]);

  if (needCollocations && cols && cols.length > 0) {
    result.collocations = cols;
  }
  if (dictData) {
    if (needPhonetic && dictData.phonetic) {
      result.phonetic = dictData.phonetic;
    }
    if (needMeaning && dictData.meaning) {
      result.meaning = dictData.meaning;
    }
  }
  if (needViMeaning && viM) {
    result.viMeaning = viM;
  }

  // 4. Handle example: if Free Dictionary gave us an example sentence, translate & use it immediately (bypassing slow Tatoeba)
  if (needExample) {
    if (dictData && dictData.example) {
      const viEx = await translateToVi(dictData.example);
      result.example = viEx ? `${dictData.example} (${viEx})` : dictData.example;
    } else {
      const ex = await fetchExampleSentence(currentWord);
      if (ex) result.example = ex;
    }
  }

  return result;
};

/**
 * Batch enrichment worker with concurrency control, live progress callback, and real-time per-word persistence
 */
export const enrichWordsBatch = async (wordsToEnrich, options = {}, onProgress, isCancelledRef, onWordEnriched) => {
  if (!wordsToEnrich || wordsToEnrich.length === 0) return [];

  const concurrency = options.concurrency || 6;
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

        // Persist immediately in real-time as each word completes
        if (onWordEnriched && typeof onWordEnriched === 'function') {
          try {
            onWordEnriched(enriched, index);
          } catch (callbackErr) {
            console.error('Error in onWordEnriched callback:', callbackErr);
          }
        }
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

      // Minimal throttle between tasks to maintain smooth UI and avoid browser rate limits
      await new Promise(r => setTimeout(r, 20));
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
  await Promise.all(workers);

  return results;
};
