import React, { useRef } from 'react';
import { Settings as SettingsIcon, Save, Download, Upload, RotateCcw, Trash2, Palette, BookOpen, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';

const Settings = ({
  words,
  settings,
  updateSettings,
  importData,
  importSnapshot,
  getFullSnapshotForBackup,
  clearAllWords,
}) => {
  const [localSettings, setLocalSettings] = React.useState(settings);
  const [saved, setSaved] = React.useState(false);
  const [dataMessage, setDataMessage] = React.useState('');
  const [importMode, setImportMode] = React.useState('merge');
  const fileInputRef = useRef(null);
  const excelInputRef = useRef(null);
  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleDeleteAll = () => {
    if (words.length === 0) {
      alert('Không có từ vựng nào để xóa.');
      return;
    }
    const confirmDelete = window.confirm(
      `CẢNH BÁO: Xóa toàn bộ ${words.length} từ vựng?\n\n` +
        'Bạn vẫn có thể khôi phục từ bản sao lưu tự động hoặc file JSON đã export.'
    );
    if (confirmDelete) {
      clearAllWords();
      setDataMessage('Đã xóa toàn bộ từ vựng.');
      setTimeout(() => setDataMessage(''), 3000);
    }
  };

  const [voices, setVoices] = React.useState([]);

  React.useEffect(() => {
    const fetchVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      const enVoices = allVoices.filter((v) => v.lang.startsWith('en'));
      setVoices(enVoices.length > 0 ? enVoices : allVoices);
    };

    fetchVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = fetchVoices;
    }
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let nextVal = value;
    if (type === 'number') nextVal = Number(value);
    if (type === 'checkbox') nextVal = checked;
    setLocalSettings((prev) => ({ ...prev, [name]: nextVal }));
    setSaved(false);
  };

  const handleSave = () => {
    updateSettings(localSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleExport = () => {
    const snapshot = getFullSnapshotForBackup
      ? getFullSnapshotForBackup()
      : words;
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(snapshot, null, 2));
    const node = document.createElement('a');
    node.setAttribute('href', dataStr);
    node.setAttribute(
      'download',
      `spacedrep_backup_${new Date().toISOString().split('T')[0]}.json`
    );
    document.body.appendChild(node);
    node.click();
    node.remove();
    setDataMessage('Đã xuất bản sao lưu đầy đủ (từ + lịch sử + cài đặt).');
    setTimeout(() => setDataMessage(''), 3000);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        const label =
          importMode === 'replace'
            ? 'GHI ĐÈ toàn bộ dữ liệu hiện tại'
            : 'GỘP (merge) vào dữ liệu hiện tại — giữ SRS của từ đã có';
        const count = Array.isArray(importedData)
          ? importedData.length
          : importedData?.words?.length || 0;

        if (
          !window.confirm(
            `Import ${count} từ — chế độ: ${label}.\n\nTiếp tục?`
          )
        ) {
          return;
        }

        if (importSnapshot) {
          const result = importSnapshot(importedData, importMode);
          setDataMessage(
            importMode === 'replace'
              ? `Đã thay thế bằng ${result.total} từ.`
              : `Đã gộp: +${result.added} mới, cập nhật ${result.updated}.`
          );
        } else if (Array.isArray(importedData)) {
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

  const handleExportExcel = () => {
    if (words.length === 0) {
      alert('Không có từ vựng nào để xuất.');
      return;
    }
    const data = words.map((w) => ({
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
          .map((row) => ({
            id: uuidv4(),
            word: String(row.Word || row.word || '').trim(),
            phonetic: String(row.Phonetic || row.phonetic || '').trim(),
            wordType: String(row.Type || row.type || row.wordType || '').trim(),
            meaning: String(row['Meaning (EN)'] || row.meaning || '').trim(),
            viMeaning: String(row['Meaning (VI)'] || row.viMeaning || '').trim(),
            example: String(row.Example || row.example || '').trim(),
            tags: (row.Tags || row.tags)
              ? String(row.Tags || row.tags)
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean)
              : [],
            repetition: 0,
            interval: 1,
            ease: 2.5,
            nextReviewDate: new Date().setHours(0, 0, 0, 0),
          }))
          .filter((w) => w.word !== '');

        if (importedWords.length === 0) {
          alert('Không tìm thấy từ vựng nào hợp lệ trong file Excel.');
          return;
        }

        const label =
          importMode === 'replace'
            ? 'GHI ĐÈ toàn bộ dữ liệu hiện tại'
            : 'GỘP (merge) vào dữ liệu hiện tại — giữ SRS của từ đã có';

        if (
          !window.confirm(
            `Import ${importedWords.length} từ từ Excel — chế độ: ${label}.\n\nTiếp tục?`
          )
        ) {
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

  const handleRestoreAutoBackup = () => {
    const fullStr = localStorage.getItem('spacedrep_full_backup');
    const backupStr = fullStr || localStorage.getItem('spacedrep_vocab_backup');
    if (!backupStr) {
      alert('Không tìm thấy bản sao lưu tự động.');
      return;
    }
    try {
      const backupData = JSON.parse(backupStr);
      const count = Array.isArray(backupData)
        ? backupData.length
        : backupData?.words?.length || 0;
      if (
        window.confirm(
          `Khôi phục ${count} từ từ bản sao lưu tự động? Sẽ ghi đè dữ liệu hiện tại.`
        )
      ) {
        if (importSnapshot) {
          importSnapshot(backupData, 'replace');
        } else if (Array.isArray(backupData)) {
          importData(backupData);
        }
        setDataMessage('Đã khôi phục từ bản sao lưu tự động.');
        setTimeout(() => setDataMessage(''), 3000);
      }
    } catch {
      alert('Bản sao lưu bị hỏng.');
    }
  };

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        paddingBottom: '2rem',
      }}
    >
      <div className="glass-panel" style={{ width: '100%', maxWidth: '540px' }}>
        <h2
          style={{
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '1.1rem',
          }}
        >
          <SettingsIcon size={20} className="text-gradient" /> Cài đặt
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.9rem' }}>
              Giới hạn ôn mỗi ngày
            </label>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
              Số từ tối đa ôn theo SRS trong một ngày.
            </p>
            <input
              type="number"
              name="dailyLimit"
              className="input-field"
              value={localSettings.dailyLimit}
              onChange={handleChange}
              min="1"
              max="1000"
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.9rem' }}>
              Hệ số khoảng cách
            </label>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
              Cao hơn = giãn cách ôn nhanh hơn (mặc định: 1).
            </p>
            <input
              type="number"
              name="intervalMultiplier"
              className="input-field"
              value={localSettings.intervalMultiplier}
              onChange={handleChange}
              min="0.1"
              max="5"
              step="0.1"
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.9rem' }}>
              Giọng phát âm
            </label>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
              Giọng đọc từ khi bấm loa / phím Ctrl hoặc Enter.
            </p>
            <select
              name="voiceURI"
              className="input-field"
              value={localSettings.voiceURI || ''}
              onChange={handleChange}
            >
              <option value="">Mặc định hệ thống</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.35rem',
                fontWeight: 600,
                fontSize: '0.9rem',
              }}
            >
              <Palette size={16} /> Giao diện
            </label>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
              Chọn theme sáng (Sepia) hoặc tối (Dark).
            </p>
            <select
              name="theme"
              className="input-field"
              value={localSettings.theme || 'sepia'}
              onChange={handleChange}
            >
              <option value="sepia">Sepia (sáng, dễ đọc)</option>
              <option value="dark">Dark (tối)</option>
            </select>
          </div>

          <div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.35rem',
                fontWeight: 600,
                fontSize: '0.9rem',
              }}
            >
              <BookOpen size={16} /> Bài tập đặt câu sau flashcard
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem',
                marginBottom: '0.5rem',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                name="enableSentencePractice"
                checked={localSettings.enableSentencePractice !== false}
                onChange={handleChange}
                style={{ width: 16, height: 16, accentColor: 'var(--accent-primary)' }}
              />
              Bật bài đặt câu sau khi ôn xong (có thể bỏ qua trong phiên)
            </label>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
              Số từ tối đa làm bài đặt câu mỗi phiên (0 = tất cả từ đã nhớ).
            </p>
            <input
              type="number"
              name="maxSentenceWords"
              className="input-field"
              value={localSettings.maxSentenceWords ?? 5}
              onChange={handleChange}
              min="0"
              max="100"
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.9rem' }}>
              Gemini API Key
            </label>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
              Dùng chấm bài đặt câu & auto-tag. Lấy key miễn phí tại{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--accent-primary)' }}
              >
                Google AI Studio
              </a>
              . Key chỉ lưu trên máy bạn.
            </p>
            <input
              type="password"
              name="geminiApiKey"
              className="input-field"
              value={localSettings.geminiApiKey || ''}
              onChange={handleChange}
              placeholder="AIzaSy..."
              autoComplete="off"
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.9rem' }}>
              Mô hình Gemini
            </label>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
              Model dùng cho chấm câu / gắn tag.
            </p>
            <select
              name="geminiModel"
              className="input-field"
              value={localSettings.geminiModel || 'gemini-2.5-flash-lite'}
              onChange={handleChange}
            >
              <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
              <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite</option>
              <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Preview)</option>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
              <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite (mặc định)</option>
            </select>
          </div>

          <button onClick={handleSave} className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
            <Save size={16} /> Lưu cài đặt
          </button>

          {saved && (
            <div
              style={{
                color: 'var(--accent-success)',
                padding: '0.5rem',
                background: 'rgba(16,185,129,0.1)',
                borderRadius: '8px',
                textAlign: 'center',
                fontSize: '0.85rem',
              }}
            >
              Đã lưu cài đặt!
            </div>
          )}
        </div>
      </div>

      <div className="glass-panel" style={{ width: '100%', maxWidth: '540px' }}>
        <h2
          style={{
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '1.1rem',
          }}
        >
          <Save size={20} className="text-gradient" /> Quản lý dữ liệu
        </h2>

        <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
          App tự backup mỗi ngày. Export đầy đủ gồm từ vựng, lịch sử ôn, chủ đề và cài đặt.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button onClick={handleExport} className="btn btn-outline" style={{ justifyContent: 'center' }}>
              <Download size={16} /> Xuất Backup (JSON)
            </button>
            <button onClick={handleExportExcel} className="btn btn-outline" style={{ justifyContent: 'center', color: 'var(--accent-success)', borderColor: 'rgba(16,185,129,0.3)' }}>
              <FileSpreadsheet size={16} /> Xuất Excel
            </button>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.85rem' }}>
              Chế độ import
            </label>
            <select
              className="input-field"
              value={importMode}
              onChange={(e) => setImportMode(e.target.value)}
              style={{ marginBottom: '0.5rem' }}
            >
              <option value="merge">Gộp (merge) — giữ SRS từ đã có</option>
              <option value="replace">Ghi đè toàn bộ</option>
            </select>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button
                onClick={() => fileInputRef.current.click()}
                className="btn btn-outline"
                style={{ justifyContent: 'center' }}
              >
                <Upload size={16} /> Import JSON
              </button>
              <button
                onClick={() => excelInputRef.current.click()}
                className="btn btn-outline"
                style={{ justifyContent: 'center', color: 'var(--accent-success)', borderColor: 'rgba(16,185,129,0.3)' }}
              >
                <FileSpreadsheet size={16} /> Import Excel
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImport}
              accept=".json"
              style={{ display: 'none' }}
            />
            <input
              type="file"
              ref={excelInputRef}
              onChange={handleImportExcel}
              accept=".xlsx, .xls, .csv"
              style={{ display: 'none' }}
            />
          </div>

          <button
            onClick={handleRestoreAutoBackup}
            className="btn btn-outline"
            style={{
              justifyContent: 'center',
              color: 'var(--accent-warning)',
              borderColor: 'rgba(245,158,11,0.3)',
            }}
          >
            <RotateCcw size={16} /> Khôi phục bản tự động
          </button>

          <button
            onClick={handleDeleteAll}
            className="btn btn-outline"
            style={{
              justifyContent: 'center',
              color: 'var(--accent-danger)',
              borderColor: 'rgba(239, 68, 68, 0.3)',
              marginTop: '0.5rem',
            }}
          >
            <Trash2 size={16} /> Xóa toàn bộ từ vựng
          </button>

          {dataMessage && (
            <div
              style={{
                color: 'var(--accent-success)',
                padding: '0.5rem',
                background: 'rgba(16,185,129,0.1)',
                borderRadius: '8px',
                textAlign: 'center',
                fontSize: '0.85rem',
                marginTop: '0.5rem',
              }}
            >
              {dataMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
