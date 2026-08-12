import React, { useRef, useState } from 'react';
import { X, Download, Upload, FileSpreadsheet, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';

const DataModal = ({
  words,
  filteredWords,
  importData,
  importSnapshot,
  getFullSnapshotForBackup,
  onClose
}) => {
  const [importMode, setImportMode] = useState('merge');
  const [dataMessage, setDataMessage] = useState('');
  const [stripSRS, setStripSRS] = useState(false);
  const [onlyNoSRS, setOnlyNoSRS] = useState(false);
  const fileInputRef = useRef(null);
  const excelInputRef = useRef(null);
  const csvInputRef = useRef(null);

  const cleanSRSInfo = (word) => {
    const {
      repetition,
      interval,
      efactor,
      ease,
      nextReviewDate,
      lastReviewed,
      isReviewedToday,
      ...cleanWord
    } = word;
    return cleanWord;
  };

  const getExportData = (useFiltered) => {
    let source = useFiltered ? filteredWords : words;
    if (onlyNoSRS) {
      source = source.filter(
        (w) => (!w.lastReviewed || w.lastReviewed === null) && (w.repetition === 0 || !w.repetition)
      );
    }
    return source;
  };

  const handleExportJSON = (useFiltered, forceStrip = false) => {
    const source = getExportData(useFiltered);
    const shouldStrip = stripSRS || forceStrip;

    if (source.length === 0 && onlyNoSRS) {
      alert('Không tìm thấy từ vựng nào chưa có thông tin SRS.');
      return;
    }

    let dataToExport;
    if (!useFiltered && !shouldStrip && !onlyNoSRS && getFullSnapshotForBackup) {
      dataToExport = getFullSnapshotForBackup();
    } else {
      dataToExport = shouldStrip ? source.map(cleanSRSInfo) : source;
    }

    const suffix = `${onlyNoSRS ? '_unstudied' : ''}${shouldStrip ? '_no_srs' : ''}`;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(dataToExport, null, 2));
    const node = document.createElement('a');
    node.setAttribute('href', dataStr);
    node.setAttribute('download', `spacedrep_vocab${suffix}_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(node);
    node.click();
    node.remove();
    setDataMessage(`Đã xuất file JSON${shouldStrip ? ' (không có SRS)' : ''}${onlyNoSRS ? ' (từ chưa học)' : ''} thành công.`);
    setTimeout(() => setDataMessage(''), 3000);
  };

  const getSRSStatus = (word) => {
    if (!word.lastReviewed && (!word.repetition || word.repetition === 0)) return 'Chưa học';
    if (word.repetition >= 3) return 'Thành thạo';
    return 'Đang học';
  };

  const handleExportExcel = (useFiltered) => {
    const dataToExport = getExportData(useFiltered);
    if (dataToExport.length === 0) {
      alert('Không có từ vựng nào để xuất.');
      return;
    }
    const data = dataToExport.map((w) => {
      const row = {
        Word: w.word,
        Phonetic: w.phonetic || '',
        Type: w.wordType || '',
        'Meaning (EN)': w.meaning || '',
        'Meaning (VI)': w.viMeaning || '',
        Example: w.example || '',
        Tags: (w.tags || []).join(', '),
      };
      if (!stripSRS) {
        row['SRS Status'] = getSRSStatus(w);
        row['Repetition'] = w.repetition ?? 0;
        row['Interval (Days)'] = w.interval ?? 1;
        row['E-Factor'] = w.efactor ?? w.ease ?? 2.5;
        row['Next Review Date'] = w.nextReviewDate ? new Date(w.nextReviewDate).toISOString().split('T')[0] : '';
        row['Last Reviewed'] = w.lastReviewed ? new Date(w.lastReviewed).toISOString().split('T')[0] : '';
      }
      return row;
    });
    const suffix = onlyNoSRS ? '_unstudied' : '';
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vocab');
    XLSX.writeFile(wb, `spacedrep_vocab${suffix}_${new Date().toISOString().split('T')[0]}.xlsx`);
    setDataMessage(`Đã xuất file Excel (kèm thông tin SRS).`);
    setTimeout(() => setDataMessage(''), 3000);
  };

  const handleExportCSV = (useFiltered) => {
    const dataToExport = getExportData(useFiltered);
    if (dataToExport.length === 0) {
      alert('Không có từ vựng nào để xuất.');
      return;
    }

    const headers = stripSRS
      ? ['Word', 'Phonetic', 'Type', 'Meaning (EN)', 'Meaning (VI)', 'Example', 'Tags']
      : ['Word', 'Phonetic', 'Type', 'Meaning (EN)', 'Meaning (VI)', 'Example', 'Tags', 'SRS Status', 'Repetition', 'Interval (Days)', 'E-Factor', 'Next Review Date', 'Last Reviewed'];

    const rows = dataToExport.map((w) => {
      const baseRow = [
        w.word || '',
        w.phonetic || '',
        w.wordType || '',
        w.meaning || '',
        w.viMeaning || '',
        w.example || '',
        (w.tags || []).join(', '),
      ];
      if (!stripSRS) {
        baseRow.push(
          getSRSStatus(w),
          w.repetition ?? 0,
          w.interval ?? 1,
          w.efactor ?? w.ease ?? 2.5,
          w.nextReviewDate ? new Date(w.nextReviewDate).toISOString().split('T')[0] : '',
          w.lastReviewed ? new Date(w.lastReviewed).toISOString().split('T')[0] : ''
        );
      }
      return baseRow;
    });

    const formatCell = (val) => {
      const stringVal = String(val ?? '');
      if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
        return `"${stringVal.replace(/"/g, '""')}"`;
      }
      return stringVal;
    };

    const csvContent =
      '\uFEFF' +
      [headers, ...rows].map((row) => row.map(formatCell).join(',')).join('\n');

    const suffix = onlyNoSRS ? '_unstudied' : '';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `spacedrep_vocab${suffix}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDataMessage(`Đã xuất file CSV (kèm thông tin SRS) thành công.`);
    setTimeout(() => setDataMessage(''), 3000);
  };

  const handleImportJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        const label = importMode === 'replace'
          ? 'GHI ĐÈ toàn bộ dữ liệu hiện tại'
          : 'GỘP (merge) vào dữ liệu hiện tại';
        const count = Array.isArray(importedData)
          ? importedData.length
          : importedData?.words?.length || 0;

        if (!window.confirm(`Import ${count} từ — chế độ: ${label}.\n\nTiếp tục?`)) {
          return;
        }

        if (importSnapshot) {
          const result = importSnapshot(importedData, importMode);
          setDataMessage(
            importMode === 'replace'
              ? `Đã thay thế bằng ${result.total} từ.`
              : `Đã gộp: +${result.added} mới, cập nhật ${result.updated}.`
          );
        } else if (Array.isArray(importedData) && importData) {
          importData(importedData);
          setDataMessage('Đã import thành công.');
        } else {
          alert('Định dạng file không hợp lệ.');
          return;
        }
        setTimeout(() => setDataMessage(''), 4000);
      } catch {
        alert('Không đọc được file backup (JSON lỗi).');
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const importedWords = jsonData
          .map((row) => {
            const getVal = (keys) => {
              for (const k of Object.keys(row)) {
                if (keys.includes(String(k).toLowerCase().trim())) {
                  return row[k];
                }
              }
              return '';
            };

            const parseRepetitionVal = (keys, fallback = 0) => {
              const val = getVal(keys);
              if (val !== '' && val !== undefined && val !== null) {
                const str = String(val).trim().toLowerCase();
                if (str.includes('thành thạo') || str.includes('mastered')) return 3;
                if (str.includes('đang học') || str.includes('learning')) return 1;
                if (str.includes('chưa học') || str.includes('new')) return 0;
                const n = Number(val);
                return isNaN(n) ? fallback : n;
              }
              return fallback;
            };

            const parseNum = (keys, fallback) => {
              const val = getVal(keys);
              if (val !== '' && val !== undefined && val !== null) {
                const n = Number(val);
                return isNaN(n) ? fallback : n;
              }
              return fallback;
            };

            const parseNextReview = () => {
              const val = getVal(['next review date', 'nextreviewdate', 'ngày ôn tiếp theo', 'ngày ôn']);
              if (val) {
                const parsed = Date.parse(val);
                if (!isNaN(parsed)) return new Date(parsed).setHours(0, 0, 0, 0);
                const n = Number(val);
                if (!isNaN(n) && n > 0) return n;
              }
              return new Date().setHours(0, 0, 0, 0);
            };

            const parseLastReviewed = () => {
              const val = getVal(['last reviewed', 'lastreviewed', 'lần ôn cuối', 'ngày ôn cuối']);
              if (val) {
                const parsed = Date.parse(val);
                if (!isNaN(parsed)) return new Date(parsed).getTime();
                const n = Number(val);
                if (!isNaN(n) && n > 0) return n;
              }
              return null;
            };

            return {
              id: uuidv4(),
              word: String(getVal(['word', 'từ', 'từ vựng', 'vocab', 'term'])).trim(),
              phonetic: String(getVal(['phonetic', 'phiên âm', 'pronunciation', 'phát âm', 'ipa'])).trim(),
              wordType: String(getVal(['type', 'word type', 'từ loại', 'loại từ'])).trim(),
              meaning: String(getVal(['meaning (en)', 'meaning', 'english', 'definition', 'định nghĩa', 'nghĩa tiếng anh'])).trim(),
              viMeaning: String(getVal(['meaning (vi)', 'vietnamese', 'vi', 'vimeaning', 'nghĩa tiếng việt', 'tiếng việt', 'nghĩa vi', 'dịch nghĩa', 'nghĩa'])).trim(),
              example: String(getVal(['example', 'examples', 'example chunks', 'ví dụ', 'câu ví dụ', 'sentence'])).trim(),
              tags: getVal(['tags', 'tag', 'chủ đề'])
                ? String(getVal(['tags', 'tag', 'chủ đề']))
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean)
                : [],
              repetition: parseRepetitionVal(['repetition', 'số lần ôn', 'rep', 'lần ôn', 'srs', 'srs status', 'srs stage', 'srs level', 'srs count', 'srs repetition'], 0),
              interval: parseNum(['interval (days)', 'interval', 'khoảng cách', 'khoảng cách ôn'], 1),
              efactor: parseNum(['e-factor', 'efactor', 'ease', 'hệ số dễ', 'ef'], 2.5),
              nextReviewDate: parseNextReview(),
              lastReviewed: parseLastReviewed(),
            };
          })
          .filter((w) => w.word !== '');

        if (importedWords.length === 0) {
          alert('Không tìm thấy từ vựng nào hợp lệ trong file Excel.');
          return;
        }

        const label = importMode === 'replace'
          ? 'GHI ĐÈ toàn bộ dữ liệu hiện tại'
          : 'GỘP (merge) vào dữ liệu hiện tại';

        if (!window.confirm(`Import ${importedWords.length} từ từ Excel — chế độ: ${label}.\n\nTiếp tục?`)) {
          return;
        }

        if (importSnapshot) {
          const result = importSnapshot(importedWords, importMode);
          setDataMessage(
            importMode === 'replace'
              ? `Đã thay thế bằng ${result.total} từ.`
              : `Đã gộp: +${result.added} mới, cập nhật ${result.updated}.`
          );
        }
      } catch (error) {
        console.error('Excel import error:', error);
        alert('Lỗi đọc file Excel. Vui lòng kiểm tra lại định dạng.');
      }
      setTimeout(() => setDataMessage(''), 4000);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = null;
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const importedWords = jsonData
          .map((row) => {
            const getVal = (keys) => {
              for (const k of Object.keys(row)) {
                if (keys.includes(String(k).toLowerCase().trim())) {
                  return row[k];
                }
              }
              return '';
            };

            const parseRepetitionVal = (keys, fallback = 0) => {
              const val = getVal(keys);
              if (val !== '' && val !== undefined && val !== null) {
                const str = String(val).trim().toLowerCase();
                if (str.includes('thành thạo') || str.includes('mastered')) return 3;
                if (str.includes('đang học') || str.includes('learning')) return 1;
                if (str.includes('chưa học') || str.includes('new')) return 0;
                const n = Number(val);
                return isNaN(n) ? fallback : n;
              }
              return fallback;
            };

            const parseNum = (keys, fallback) => {
              const val = getVal(keys);
              if (val !== '' && val !== undefined && val !== null) {
                const n = Number(val);
                return isNaN(n) ? fallback : n;
              }
              return fallback;
            };

            const parseNextReview = () => {
              const val = getVal(['next review date', 'nextreviewdate', 'ngày ôn tiếp theo', 'ngày ôn']);
              if (val) {
                const parsed = Date.parse(val);
                if (!isNaN(parsed)) return new Date(parsed).setHours(0, 0, 0, 0);
                const n = Number(val);
                if (!isNaN(n) && n > 0) return n;
              }
              return new Date().setHours(0, 0, 0, 0);
            };

            const parseLastReviewed = () => {
              const val = getVal(['last reviewed', 'lastreviewed', 'lần ôn cuối', 'ngày ôn cuối']);
              if (val) {
                const parsed = Date.parse(val);
                if (!isNaN(parsed)) return new Date(parsed).getTime();
                const n = Number(val);
                if (!isNaN(n) && n > 0) return n;
              }
              return null;
            };

            return {
              id: uuidv4(),
              word: String(getVal(['word', 'từ', 'từ vựng', 'vocab', 'term'])).trim(),
              phonetic: String(getVal(['phonetic', 'phiên âm', 'pronunciation', 'phát âm', 'ipa'])).trim(),
              wordType: String(getVal(['type', 'word type', 'từ loại', 'loại từ'])).trim(),
              meaning: String(getVal(['meaning (en)', 'meaning', 'english', 'definition', 'định nghĩa', 'nghĩa tiếng anh'])).trim(),
              viMeaning: String(getVal(['meaning (vi)', 'vietnamese', 'vi', 'vimeaning', 'nghĩa tiếng việt', 'tiếng việt', 'nghĩa vi', 'dịch nghĩa', 'nghĩa'])).trim(),
              example: String(getVal(['example', 'examples', 'example chunks', 'ví dụ', 'câu ví dụ', 'sentence'])).trim(),
              tags: getVal(['tags', 'tag', 'chủ đề'])
                ? String(getVal(['tags', 'tag', 'chủ đề']))
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean)
                : [],
              repetition: parseRepetitionVal(['repetition', 'số lần ôn', 'rep', 'lần ôn', 'srs', 'srs status', 'srs stage', 'srs level', 'srs count', 'srs repetition'], 0),
              interval: parseNum(['interval (days)', 'interval', 'khoảng cách', 'khoảng cách ôn'], 1),
              efactor: parseNum(['e-factor', 'efactor', 'ease', 'hệ số dễ', 'ef'], 2.5),
              nextReviewDate: parseNextReview(),
              lastReviewed: parseLastReviewed(),
            };
          })
          .filter((w) => w.word !== '');

        if (importedWords.length === 0) {
          alert('Không tìm thấy từ vựng nào hợp lệ trong file CSV.');
          return;
        }

        const label = importMode === 'replace'
          ? 'GHI ĐÈ toàn bộ dữ liệu hiện tại'
          : 'GỘP (merge) vào dữ liệu hiện tại';

        if (!window.confirm(`Import ${importedWords.length} từ từ CSV — chế độ: ${label}.\n\nTiếp tục?`)) {
          return;
        }

        if (importSnapshot) {
          const result = importSnapshot(importedWords, importMode);
          setDataMessage(
            importMode === 'replace'
              ? `Đã thay thế bằng ${result.total} từ từ CSV.`
              : `Đã gộp từ CSV: +${result.added} mới, cập nhật ${result.updated}.`
          );
        } else if (importData) {
          importData(importedWords);
          setDataMessage('Đã import CSV thành công.');
        }
      } catch (error) {
        console.error('CSV import error:', error);
        alert('Lỗi đọc file CSV. Vui lòng kiểm tra lại định dạng tệp.');
      }
      setTimeout(() => setDataMessage(''), 4000);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = null;
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 1000,
        display: 'grid',
        placeItems: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="modal-panel"
        style={{
          width: '100%',
          maxWidth: '500px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          padding: '1.5rem',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justify: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--glass-border)',
            paddingBottom: '0.75rem',
          }}
        >
          <h3
            style={{
              fontSize: '1.2rem',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--accent-primary)',
            }}
          >
            Nhập / Xuất dữ liệu
          </h3>
          <button onClick={onClose} className="btn btn-outline" style={{ padding: '0.4rem' }} title="Đóng">
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Export Section */}
          <div style={{ background: 'rgba(0, 0, 0, 0.05)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
            <h4 style={{ marginBottom: '0.75rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Download size={18} /> Xuất Dữ Liệu
            </h4>

            {/* SRS Toggles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem', fontSize: '0.85rem', background: 'var(--glass-bg)', padding: '0.6rem 0.75rem', borderRadius: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={stripSRS}
                  onChange={(e) => setStripSRS(e.target.checked)}
                />
                <span>Loại bỏ thông tin SRS (chỉ xuất nội dung từ vựng)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={onlyNoSRS}
                  onChange={(e) => setOnlyNoSRS(e.target.checked)}
                />
                <span>Chỉ xuất từ vựng chưa có SRS (chưa học)</span>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <button onClick={() => handleExportJSON(false)} className="btn btn-outline" style={{ justifyContent: 'center', fontSize: '0.85rem' }}>
                JSON (Tất cả)
              </button>
              <button onClick={() => handleExportJSON(true)} className="btn btn-outline" style={{ justifyContent: 'center', fontSize: '0.85rem' }}>
                JSON (Theo bộ lọc)
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <button
                onClick={() => handleExportJSON(false, true)}
                className="btn btn-outline"
                style={{
                  justify: 'center',
                  fontSize: '0.85rem',
                  color: 'var(--accent-primary)',
                  borderColor: 'var(--accent-primary)',
                  background: 'rgba(59, 130, 246, 0.08)'
                }}
              >
                <Download size={14} /> JSON Sạch (Không kèm dữ liệu SRS)
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <button onClick={() => handleExportExcel(false)} className="btn btn-outline" style={{ justifyContent: 'center', fontSize: '0.85rem', color: 'var(--accent-success)', borderColor: 'rgba(16,185,129,0.3)' }}>
                Excel (Tất cả)
              </button>
              <button onClick={() => handleExportExcel(true)} className="btn btn-outline" style={{ justifyContent: 'center', fontSize: '0.85rem', color: 'var(--accent-success)', borderColor: 'rgba(16,185,129,0.3)' }}>
                Excel (Theo bộ lọc)
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button onClick={() => handleExportCSV(false)} className="btn btn-outline" style={{ justifyContent: 'center', fontSize: '0.85rem', color: 'var(--accent-warning, #f59e0b)', borderColor: 'rgba(245,158,11,0.3)' }}>
                <FileText size={15} /> CSV (Tất cả)
              </button>
              <button onClick={() => handleExportCSV(true)} className="btn btn-outline" style={{ justifyContent: 'center', fontSize: '0.85rem', color: 'var(--accent-warning, #f59e0b)', borderColor: 'rgba(245,158,11,0.3)' }}>
                <FileText size={15} /> CSV (Bộ lọc)
              </button>
            </div>
          </div>

          {/* Import Section */}
          <div style={{ background: 'rgba(0, 0, 0, 0.05)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
            <h4 style={{ marginBottom: '0.75rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Upload size={18} /> Nhập Dữ Liệu
            </h4>
            
            <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.85rem' }}>
              Chế độ import:
            </label>
            <select
              className="input-field"
              value={importMode}
              onChange={(e) => setImportMode(e.target.value)}
              style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}
            >
              <option value="merge" style={{ background: 'var(--bg-dark)', color: 'var(--text-main)' }}>Gộp (merge) — giữ tiến độ cũ</option>
              <option value="replace" style={{ background: 'var(--bg-dark)', color: 'var(--text-main)' }}>Ghi đè toàn bộ dữ liệu</option>
            </select>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <button onClick={() => fileInputRef.current.click()} className="btn btn-outline" style={{ justifyContent: 'center', fontSize: '0.85rem', padding: '0.5rem 0.25rem' }}>
                <Upload size={15} /> JSON
              </button>
              <button onClick={() => excelInputRef.current.click()} className="btn btn-outline" style={{ justifyContent: 'center', fontSize: '0.85rem', color: 'var(--accent-success)', borderColor: 'rgba(16,185,129,0.3)', padding: '0.5rem 0.25rem' }}>
                <FileSpreadsheet size={15} /> Excel
              </button>
              <button onClick={() => csvInputRef.current.click()} className="btn btn-outline" style={{ justifyContent: 'center', fontSize: '0.85rem', color: 'var(--accent-warning, #f59e0b)', borderColor: 'rgba(245,158,11,0.3)', padding: '0.5rem 0.25rem' }}>
                <FileText size={15} /> CSV
              </button>
            </div>

            <input type="file" ref={fileInputRef} onChange={handleImportJSON} accept=".json" style={{ display: 'none' }} />
            <input type="file" ref={excelInputRef} onChange={handleImportExcel} accept=".xlsx, .xls" style={{ display: 'none' }} />
            <input type="file" ref={csvInputRef} onChange={handleImportCSV} accept=".csv" style={{ display: 'none' }} />
          </div>

          {dataMessage && (
            <div style={{
              color: 'var(--accent-success)',
              padding: '0.5rem',
              background: 'rgba(16,185,129,0.1)',
              borderRadius: '8px',
              textAlign: 'center',
              fontSize: '0.85rem'
            }}>
              {dataMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataModal;
