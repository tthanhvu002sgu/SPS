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
  const fileInputRef = useRef(null);
  const excelInputRef = useRef(null);
  const csvInputRef = useRef(null);

  const handleExportJSON = (useFiltered) => {
    const dataToExport = useFiltered ? filteredWords : (getFullSnapshotForBackup ? getFullSnapshotForBackup() : words);
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(dataToExport, null, 2));
    const node = document.createElement('a');
    node.setAttribute('href', dataStr);
    node.setAttribute('download', `spacedrep_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(node);
    node.click();
    node.remove();
    setDataMessage('Đã xuất file JSON thành công.');
    setTimeout(() => setDataMessage(''), 3000);
  };

  const handleExportExcel = (useFiltered) => {
    const dataToExport = useFiltered ? filteredWords : words;
    if (dataToExport.length === 0) {
      alert('Không có từ vựng nào để xuất.');
      return;
    }
    const data = dataToExport.map((w) => ({
      Word: w.word,
      Phonetic: w.phonetic || '',
      Type: w.wordType || '',
      'Meaning (EN)': w.meaning || '',
      'Meaning (VI)': w.viMeaning || '',
      Example: w.example || '',
      Tags: (w.tags || []).join(', '),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vocab');
    XLSX.writeFile(wb, `spacedrep_vocab_${new Date().toISOString().split('T')[0]}.xlsx`);
    setDataMessage('Đã xuất file Excel.');
    setTimeout(() => setDataMessage(''), 3000);
  };

  const handleExportCSV = (useFiltered) => {
    const dataToExport = useFiltered ? filteredWords : words;
    if (dataToExport.length === 0) {
      alert('Không có từ vựng nào để xuất.');
      return;
    }

    const headers = ['Word', 'Phonetic', 'Type', 'Meaning (EN)', 'Meaning (VI)', 'Example', 'Tags'];
    const rows = dataToExport.map((w) => [
      w.word || '',
      w.phonetic || '',
      w.wordType || '',
      w.meaning || '',
      w.viMeaning || '',
      w.example || '',
      (w.tags || []).join(', '),
    ]);

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

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `spacedrep_vocab_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDataMessage('Đã xuất file CSV thành công.');
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

            return {
              id: uuidv4(),
              word: String(getVal(['word', 'từ', 'từ vựng', 'vocab'])).trim(),
              phonetic: String(getVal(['phonetic', 'phiên âm', 'pronunciation'])).trim(),
              wordType: String(getVal(['type', 'word type', 'từ loại'])).trim(),
              meaning: String(getVal(['meaning (en)', 'meaning', 'english', 'định nghĩa'])).trim(),
              viMeaning: String(getVal(['meaning (vi)', 'vietnamese', 'vi', 'nghĩa tiếng việt', 'nghĩa vi', 'dịch nghĩa', 'nghĩa'])).trim(),
              example: String(getVal(['example', 'examples', 'example chunks', 'ví dụ', 'câu ví dụ', 'sentence'])).trim(),
              tags: getVal(['tags', 'tag', 'chủ đề'])
                ? String(getVal(['tags', 'tag', 'chủ đề']))
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean)
                : [],
              repetition: 0,
              interval: 1,
              ease: 2.5,
              nextReviewDate: new Date().setHours(0, 0, 0, 0),
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
              repetition: 0,
              interval: 1,
              ease: 2.5,
              nextReviewDate: new Date().setHours(0, 0, 0, 0),
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <button onClick={() => handleExportJSON(false)} className="btn btn-outline" style={{ justifyContent: 'center', fontSize: '0.85rem' }}>
                JSON (Tất cả)
              </button>
              <button onClick={() => handleExportJSON(true)} className="btn btn-outline" style={{ justifyContent: 'center', fontSize: '0.85rem' }}>
                JSON (Theo bộ lọc)
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
