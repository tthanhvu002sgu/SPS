import React from 'react';
import { Settings as SettingsIcon, Save, RotateCcw, Trash2, Palette, BookOpen } from 'lucide-react';
import { STORAGE_KEYS, safeGetItem } from '../utils/storage';

const Settings = ({
  words,
  settings,
  updateSettings,
  importData,
  importSnapshot,
  clearAllWords,
}) => {
  const [localSettings, setLocalSettings] = React.useState(settings);
  const [saved, setSaved] = React.useState(false);
  const [dataMessage, setDataMessage] = React.useState('');
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



  const handleRestoreAutoBackup = () => {
    const fullStr = safeGetItem(STORAGE_KEYS.FULL_BACKUP);
    const backupStr = fullStr || safeGetItem(STORAGE_KEYS.LEGACY_BACKUP);
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
          App tự backup mỗi ngày. (Tính năng Export/Import đã được chuyển sang tab Thư Viện).
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

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
