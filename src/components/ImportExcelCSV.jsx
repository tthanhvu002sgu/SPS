import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { getInitialSRSData } from '../utils/srs';
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  AlertTriangle, 
  CheckCircle, 
  X, 
  Play, 
  Loader2, 
  Search, 
  Trash2, 
  Info,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';

const WORD_HEADERS = ['word', 'từ', 'từ vựng', 'vocab', 'term'];
const VI_MEANING_HEADERS = ['vietnamese', 'vi', 'vimeaning', 'nghĩa tiếng việt', 'tiếng việt', 'nghĩa vi', 'dịch nghĩa', 'nghĩa'];
const MEANING_HEADERS = ['meaning', 'english', 'definition', 'định nghĩa', 'nghĩa tiếng anh', 'english meaning', 'def'];
const PHONETIC_HEADERS = ['phonetic', 'pronunciation', 'phiên âm', 'phát âm', 'ipa'];
const EXAMPLE_HEADERS = ['example', 'sentence', 'ví dụ', 'câu ví dụ', 'câu'];

const ImportExcelCSV = ({ words = [], onAdd, onAddWords, onCloseTab }) => {
  const [parsedWords, setParsedWords] = useState([]);
  const [selectedWordIds, setSelectedWordIds] = useState(new Set());
  const [isDragOver, setIsDragOver] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [autoFetch, setAutoFetch] = useState(true);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  // Progress states
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, activeWord: '' });
  const [importSummary, setImportSummary] = useState(null);
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);

  // Reset page to 1 when filters or search terms change to prevent empty renders
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, autoFetch, skipDuplicates, parsedWords.length]);

  // Helper APIs from AddWord
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

  // Download sample CSV template with UTF-8 BOM
  const handleDownloadTemplate = () => {
    const headers = ['Word', 'Phonetic', 'Vietnamese Meaning', 'English Definition', 'Example'];
    const sampleData = [
      ['apple', '/ˈæp.əl/', 'quả táo', 'A round fruit with red, green, or yellow skin and crisp white flesh', 'He ate a red apple.'],
      ['benevolent', '/bəˈnev.əl.ənt/', 'nhân từ', 'Kind and helpful', 'A benevolent gentleman donated $5000 to charity.'],
      ['resilient', '', '', '', 'She is a resilient girl. (Meaning & phonetic will auto-fill)']
    ];
    
    const csvContent = "\uFEFF" + [headers, ...sampleData].map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "spacedrep_vocab_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Read file and parse
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file) => {
    setError('');
    setImportSummary(null);
    const fileType = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(fileType)) {
      setError('Định dạng tệp không được hỗ trợ. Vui lòng tải lên file Excel (.xlsx, .xls) hoặc CSV (.csv).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Read as array of arrays (header: 1) to manually parse headers and be extremely flexible
        const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        
        if (rawRows.length < 2) {
          setError('Tệp trống hoặc không chứa đủ dữ liệu từ vựng.');
          return;
        }

        // Parse headers to match columns
        const headers = rawRows[0].map(h => String(h).trim().toLowerCase());
        
        let wordIdx = -1;
        let phoneticIdx = -1;
        let viIdx = -1;
        let enIdx = -1;
        let exampleIdx = -1;

        headers.forEach((header, index) => {
          if (WORD_HEADERS.includes(header)) wordIdx = index;
          else if (PHONETIC_HEADERS.includes(header)) phoneticIdx = index;
          else if (VI_MEANING_HEADERS.includes(header)) viIdx = index;
          else if (MEANING_HEADERS.includes(header)) enIdx = index;
          else if (EXAMPLE_HEADERS.includes(header)) exampleIdx = index;
        });

        // Fallback to positional mapping if Word column is not detected
        if (wordIdx === -1) {
          wordIdx = 0;
          if (headers.length > 1) phoneticIdx = 1;
          if (headers.length > 2) viIdx = 2;
          if (headers.length > 3) enIdx = 3;
          if (headers.length > 4) exampleIdx = 4;
        }

        const items = [];
        const initialSelected = new Set();

        for (let i = 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || row.length === 0) continue;

          const rawWord = row[wordIdx] ? String(row[wordIdx]).trim() : '';
          if (!rawWord) continue; // Skip empty words

          const rawPhonetic = phoneticIdx !== -1 && row[phoneticIdx] ? String(row[phoneticIdx]).trim() : '';
          const rawVi = viIdx !== -1 && row[viIdx] ? String(row[viIdx]).trim() : '';
          const rawEn = enIdx !== -1 && row[enIdx] ? String(row[enIdx]).trim() : '';
          const rawExample = exampleIdx !== -1 && row[exampleIdx] ? String(row[exampleIdx]).trim() : '';

          // Check if duplicate in existing vocab library
          const isDuplicate = words.some(existing => 
            existing.word.trim().toLowerCase() === rawWord.toLowerCase()
          );

          const id = `parsed_${i}_${uuidv4()}`;

          items.push({
            id,
            word: rawWord,
            phonetic: rawPhonetic,
            viMeaning: rawVi,
            meaning: rawEn,
            example: rawExample,
            isDuplicate
          });

          // Pre-select words that are not duplicates
          if (!isDuplicate) {
            initialSelected.add(id);
          }
        }

        if (items.length === 0) {
          setError('Không tìm thấy từ vựng hợp lệ nào trong tệp.');
          return;
        }

        setParsedWords(items);
        setSelectedWordIds(initialSelected);
      } catch (err) {
        console.error(err);
        setError('Có lỗi xảy ra khi phân tích tệp. Vui lòng kiểm tra lại định dạng tệp.');
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  };

  // Handle single item selection toggle
  const toggleSelect = (id) => {
    setSelectedWordIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all / Deselect all on filtered items
  const handleSelectAll = (itemsToToggle) => {
    const allSelected = itemsToToggle.every(item => selectedWordIds.has(item.id));
    
    setSelectedWordIds(prev => {
      const next = new Set(prev);
      itemsToToggle.forEach(item => {
        if (allSelected) {
          next.delete(item.id);
        } else {
          next.add(item.id);
        }
      });
      return next;
    });
  };

  // Filter parsed items based on search input and duplication filter if checked
  const filteredItems = parsedWords.filter(item => {
    const matchesSearch = item.word.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.viMeaning.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.meaning.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Calculate pagination details
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);

  // Bulk import execution with single state update at the end
  const executeImport = async () => {
    const toImport = parsedWords.filter(item => selectedWordIds.has(item.id));
    if (toImport.length === 0) return;

    setIsImporting(true);
    setProgress({ current: 0, total: toImport.length, activeWord: '' });
    
    let addedCount = 0;
    let duplicateSkipped = 0;
    
    // A temporary list to collect all new words before committing to the parent state (adds huge performance!)
    const wordsToInsert = [];
    
    for (let i = 0; i < toImport.length; i++) {
      const currentItem = toImport[i];
      setProgress({ current: i + 1, total: toImport.length, activeWord: currentItem.word });

      // Final check for duplicates against the live library if user wanted to skip duplicates
      const isLiveDuplicate = words.some(existing => 
        existing.word.trim().toLowerCase() === currentItem.word.toLowerCase()
      );

      if (isLiveDuplicate && skipDuplicates) {
        duplicateSkipped++;
        continue;
      }

      let finalMeaning = currentItem.meaning;
      let finalViMeaning = currentItem.viMeaning;
      let finalPhonetic = currentItem.phonetic;
      let finalExample = currentItem.example;

      // Auto-fetch if enabled and fields are missing
      if (autoFetch) {
        let isFetchingNeeded = !finalMeaning || !finalViMeaning || !finalPhonetic;
        
        if (isFetchingNeeded) {
          // Fetch from English dictionary
          const dictData = await fetchFromDictionary(currentItem.word);
          if (dictData) {
            if (!finalMeaning) finalMeaning = dictData.fetchedMeaning;
            if (!finalExample) finalExample = dictData.fetchedExample;
            if (!finalPhonetic) finalPhonetic = dictData.fetchedPhonetic;
          }

          // Translate to Vietnamese
          if (!finalViMeaning) {
            finalViMeaning = await translateToVi(currentItem.word);
          }
        }
      }

      const newWordObj = {
        id: uuidv4(),
        word: currentItem.word,
        phonetic: finalPhonetic,
        meaning: finalMeaning,
        viMeaning: finalViMeaning,
        example: finalExample,
        ...getInitialSRSData(),
        dateAdded: new Date().getTime()
      };

      wordsToInsert.push(newWordObj);
      addedCount++;

      // Small delay between words if fetching APIs to respect rate limits
      if (autoFetch && i < toImport.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Call onAddWords with all collected items once! (Prevents React loop re-renders)
    if (wordsToInsert.length > 0) {
      if (onAddWords) {
        onAddWords(wordsToInsert);
      } else {
        // Fallback if prop is not set
        wordsToInsert.forEach(w => onAdd(w));
      }
    }

    setIsImporting(false);
    setImportSummary({
      total: toImport.length,
      added: addedCount,
      skipped: duplicateSkipped
    });
    setParsedWords([]);
    setSelectedWordIds(new Set());
  };

  const removeParsedItem = (id) => {
    setParsedWords(prev => prev.filter(item => item.id !== id));
    setSelectedWordIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', height: '100%' }}>
      {/* Upload Zone */}
      {parsedWords.length === 0 && !importSummary && (
        <div className="glass-panel" style={{ padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', textAlign: 'center' }}>
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current.click()}
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '2.5rem 1.5rem',
              border: isDragOver ? '2px dashed var(--accent-primary)' : '2px dashed var(--glass-border)',
              borderRadius: '16px',
              cursor: 'pointer',
              background: isDragOver ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              transition: 'all 0.25s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              boxShadow: isDragOver ? '0 0 20px rgba(59, 130, 246, 0.2)' : 'none'
            }}
          >
            <div style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(147,51,234,0.1))',
              padding: '1rem',
              borderRadius: '50%',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Upload size={32} />
            </div>
            
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                Kéo thả file vào đây hoặc nhấn để chọn
              </h3>
              <p className="text-muted" style={{ fontSize: '0.8rem' }}>
                Hỗ trợ tệp Excel (.xlsx, .xls) hoặc tệp văn bản CSV (.csv)
              </p>
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".xlsx,.xls,.csv" 
              style={{ display: 'none' }} 
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
            <p className="text-muted" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Info size={14} /> Điền từ vựng vào cột đầu tiên. Các cột nghĩa, phiên âm, ví dụ sẽ tự tra cứu nếu để trống.
            </p>
            <button 
              onClick={handleDownloadTemplate} 
              className="btn btn-outline" 
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', gap: '0.4rem' }}
            >
              <Download size={14} /> Tải file mẫu CSV
            </button>
          </div>

          {error && (
            <div style={{ 
              color: 'var(--accent-danger)', 
              padding: '0.6rem 1rem', 
              background: 'rgba(239,68,68,0.1)', 
              borderRadius: '8px', 
              fontSize: '0.85rem',
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              maxWidth: '480px'
            }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} /> {error}
            </div>
          )}
        </div>
      )}

      {/* Progress Indicator */}
      {isImporting && (
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', textAlign: 'center' }}>
          <Loader2 className="spin" size={36} color="var(--accent-primary)" />
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Đang nhập từ vựng từ tệp...</h3>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Đang xử lý: <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{progress.activeWord}</span> ({progress.current}/{progress.total})
            </p>
          </div>
          <div style={{ width: '100%', maxWidth: '360px', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden', position: 'relative' }}>
            <div style={{ 
              width: `${(progress.current / progress.total) * 100}%`, 
              height: '100%', 
              background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
              borderRadius: '999px',
              transition: 'width 0.2s ease'
            }} />
          </div>
          {autoFetch && (
            <p className="text-muted" style={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
              * Đang tự động dịch nghĩa và tra từ điển. Tiến trình có thể mất một lúc tùy số lượng từ.
            </p>
          )}
        </div>
      )}

      {/* Import Summary Result */}
      {importSummary && (
        <div className="glass-panel" style={{ padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textAlign: 'center' }}>
          <div style={{ color: 'var(--accent-success)', background: 'rgba(16,185,129,0.1)', padding: '0.75rem', borderRadius: '50%' }}>
            <CheckCircle size={32} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Đã hoàn tất nhập dữ liệu!</h3>
            <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
              Đã thêm thành công <strong style={{ color: 'var(--accent-success)' }}>{importSummary.added}</strong> từ vựng mới vào thư viện.
            </p>
            {importSummary.skipped > 0 && (
              <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                Đã bỏ qua <strong>{importSummary.skipped}</strong> từ bị trùng lặp.
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button onClick={() => setImportSummary(null)} className="btn btn-primary" style={{ padding: '0.5rem 1.2rem' }}>
              Tải file khác
            </button>
            <button onClick={onCloseTab} className="btn btn-outline" style={{ padding: '0.5rem 1.2rem' }}>
              Đóng tab
            </button>
          </div>
        </div>
      )}

      {/* Parsed Preview Table */}
      {parsedWords.length > 0 && !isImporting && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: '0.75rem' }}>
          <div className="glass-panel" style={{ padding: '0.75rem 1rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileSpreadsheet className="text-gradient" size={20} />
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Xem trước dữ liệu ({filteredItems.length}/{parsedWords.length} từ)</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={autoFetch} 
                  onChange={e => setAutoFetch(e.target.checked)} 
                  style={{ cursor: 'pointer' }}
                />
                Tự tra nghĩa/phiên âm
              </label>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={skipDuplicates} 
                  onChange={e => setSkipDuplicates(e.target.checked)} 
                  style={{ cursor: 'pointer' }}
                />
                Bỏ qua từ trùng
              </label>

              <div style={{ position: 'relative', width: '160px' }}>
                <Search size={13} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Lọc từ..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ paddingLeft: '1.8rem', paddingTop: '0.3rem', paddingBottom: '0.3rem', fontSize: '0.8rem' }}
                />
              </div>
            </div>
          </div>

          {/* Words Preview List */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            overflowY: 'auto', 
            maxHeight: '380px', // Set a maximum height to prevent stretching the parent card and trigger internal scroll
            flex: 1, 
            minHeight: 0, 
            gap: '0.25rem',
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            borderRadius: '12px',
            padding: '0.5rem'
          }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '40px 1.5fr 1fr 2.2fr 1.2fr 40px',
              padding: '0.5rem 0.75rem',
              fontWeight: 600,
              fontSize: '0.8rem',
              borderBottom: '1px solid var(--glass-border)',
              color: 'var(--text-muted)',
              alignItems: 'center',
              position: 'sticky',
              top: 0,
              zIndex: 2,
              background: '#1e2433' // Solid background matching the glass panel theme to prevent text showing through when scrolling
            }}>
              <input 
                type="checkbox" 
                checked={filteredItems.length > 0 && filteredItems.every(item => selectedWordIds.has(item.id))}
                onChange={() => handleSelectAll(filteredItems)}
                style={{ cursor: 'pointer' }}
              />
              <div>Từ vựng</div>
              <div>Phiên âm</div>
              <div>Định nghĩa (Anh / Việt)</div>
              <div>Trạng thái</div>
              <div></div>
            </div>

            {paginatedItems.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Không tìm thấy kết quả lọc.
              </div>
            ) : (
              paginatedItems.map(item => (
                <div 
                  key={item.id} 
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '40px 1.5fr 1fr 2.2fr 1.2fr 40px',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.85rem',
                    alignItems: 'center',
                    borderRadius: '8px',
                    background: item.isDuplicate ? 'rgba(245, 158, 11, 0.03)' : 'rgba(255,255,255,0.01)',
                    border: item.isDuplicate ? '1px solid rgba(245, 158, 11, 0.12)' : '1px solid transparent',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <input 
                    type="checkbox" 
                    checked={selectedWordIds.has(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    style={{ cursor: 'pointer' }}
                  />
                  
                  <div style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{item.word}</div>
                  
                  <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {item.phonetic || <span style={{ fontStyle: 'italic', fontSize: '0.75rem' }}>tự tra cứu</span>}
                  </div>
                  
                  <div style={{ overflow: 'hidden' }}>
                    {item.viMeaning && (
                      <div style={{ fontWeight: 600, color: 'var(--accent-warning)', fontSize: '0.8rem', marginBottom: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.viMeaning}
                      </div>
                    )}
                    {item.meaning && (
                      <div style={{ fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                        {item.meaning}
                      </div>
                    )}
                    {!item.viMeaning && !item.meaning && (
                      <span style={{ fontStyle: 'italic', fontSize: '0.75rem', color: 'var(--text-muted)' }}>chưa dịch</span>
                    )}
                  </div>
                  
                  <div>
                    {item.isDuplicate ? (
                      <span style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '0.25rem',
                        fontSize: '0.7rem', 
                        fontWeight: 600,
                        color: 'var(--accent-warning)', 
                        background: 'rgba(245,158,11,0.08)', 
                        padding: '0.15rem 0.45rem', 
                        borderRadius: '999px' 
                      }}>
                        <AlertTriangle size={10} /> Đã có sẵn
                      </span>
                    ) : (
                      <span style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '0.25rem',
                        fontSize: '0.7rem', 
                        fontWeight: 600,
                        color: 'var(--accent-success)', 
                        background: 'rgba(16,185,129,0.08)', 
                        padding: '0.15rem 0.45rem', 
                        borderRadius: '999px' 
                      }}>
                        <CheckCircle size={10} /> Sẵn sàng
                      </span>
                    )}
                  </div>

                  <button 
                    onClick={() => removeParsedItem(item.id)}
                    className="btn btn-outline"
                    style={{ 
                      padding: '0.25rem', 
                      borderRadius: '6px', 
                      color: 'var(--accent-danger)', 
                      borderColor: 'transparent',
                      background: 'transparent'
                    }}
                    title="Xóa hàng này"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              gap: '0.5rem', 
              padding: '0.5rem', 
              background: 'var(--glass-bg)', 
              border: '1px solid var(--glass-border)', 
              borderRadius: '12px' 
            }}>
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="btn btn-outline"
                style={{ padding: '0.35rem', borderRadius: '8px' }}
                title="Trang đầu"
              >
                <ChevronsLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="btn btn-outline"
                style={{ padding: '0.35rem', borderRadius: '8px' }}
                title="Trang trước"
              >
                <ChevronLeft size={14} />
              </button>
              
              <span style={{ fontSize: '0.8rem', padding: '0 0.5rem', fontWeight: 500 }}>
                Trang {currentPage} / {totalPages}
              </span>
              
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="btn btn-outline"
                style={{ padding: '0.35rem', borderRadius: '8px' }}
                title="Trang sau"
              >
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="btn btn-outline"
                style={{ padding: '0.35rem', borderRadius: '8px' }}
                title="Trang cuối"
              >
                <ChevronsRight size={14} />
              </button>
            </div>
          )}

          {/* Actions Bar */}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.1rem' }}>
            <button 
              onClick={() => {
                setParsedWords([]);
                setSelectedWordIds(new Set());
              }} 
              className="btn btn-outline"
              disabled={isImporting}
            >
              <X size={15} /> Hủy bỏ
            </button>
            <button 
              onClick={executeImport} 
              className="btn btn-primary"
              disabled={selectedWordIds.size === 0 || isImporting}
              style={{ minWidth: '150px' }}
            >
              {isImporting ? <Loader2 className="spin" size={15} /> : <Play size={15} />}
              Nhập {selectedWordIds.size} từ vựng
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportExcelCSV;
