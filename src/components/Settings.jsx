import React, { useRef } from 'react';
import { Settings as SettingsIcon, Save, Download, Upload, RotateCcw } from 'lucide-react';

const Settings = ({ words, settings, updateSettings, importData }) => {
  const [localSettings, setLocalSettings] = React.useState(settings);
  const [saved, setSaved] = React.useState(false);
  const [dataMessage, setDataMessage] = React.useState('');
  const fileInputRef = useRef(null);

  const [voices, setVoices] = React.useState([]);

  React.useEffect(() => {
    const fetchVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      // Filter English voices
      const enVoices = allVoices.filter(v => v.lang.startsWith('en'));
      setVoices(enVoices.length > 0 ? enVoices : allVoices);
    };

    fetchVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = fetchVoices;
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setLocalSettings(prev => ({
      ...prev,
      [name]: name === 'voiceURI' ? value : Number(value)
    }));
    setSaved(false);
  };

  const handleSave = () => {
    updateSettings(localSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(words));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `spacedrep_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    setDataMessage('Data exported successfully!');
    setTimeout(() => setDataMessage(''), 3000);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (Array.isArray(importedData)) {
          if (window.confirm(`Are you sure you want to import ${importedData.length} words? This will replace your current data.`)) {
            importData(importedData);
            setDataMessage('Data imported successfully!');
            setTimeout(() => setDataMessage(''), 3000);
          }
        } else {
          alert('Invalid backup file format.');
        }
      } catch (err) {
        alert('Error parsing backup file.');
      }
    };
    reader.readAsText(file);
    e.target.value = null; // reset input
  };

  const handleRestoreAutoBackup = () => {
    const backupStr = localStorage.getItem('spacedrep_vocab_backup');
    if (backupStr) {
      try {
        const backupData = JSON.parse(backupStr);
        if (Array.isArray(backupData) && window.confirm(`Restore ${backupData.length} words from auto-backup? This will replace your current data.`)) {
          importData(backupData);
          setDataMessage('Restored from auto-backup successfully!');
          setTimeout(() => setDataMessage(''), 3000);
        }
      } catch (e) {
        alert('Auto-backup data is corrupted.');
      }
    } else {
      alert('No auto-backup found.');
    }
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', paddingBottom: '2rem' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '540px' }}>
        <h2 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
          <SettingsIcon size={20} className="text-gradient" /> Settings
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.9rem' }}>Daily Review Limit</label>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>Max words to review per day.</p>
            <input type="number" name="dailyLimit" className="input-field" value={localSettings.dailyLimit} onChange={handleChange} min="1" max="1000" />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.9rem' }}>Interval Multiplier</label>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>Higher = faster spacing (Default: 1).</p>
            <input type="number" name="intervalMultiplier" className="input-field" value={localSettings.intervalMultiplier} onChange={handleChange} min="0.1" max="5" step="0.1" />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.9rem' }}>Pronunciation Voice</label>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>Select the voice used for auto-pronunciation.</p>
            <select name="voiceURI" className="input-field" value={localSettings.voiceURI || ''} onChange={handleChange}>
              <option value="">System Default</option>
              {voices.map(v => (
                <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
              ))}
            </select>
          </div>

          <button onClick={handleSave} className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
            <Save size={16} /> Save Settings
          </button>

          {saved && (
            <div style={{ color: 'var(--accent-success)', padding: '0.5rem', background: 'rgba(16,185,129,0.1)', borderRadius: '8px', textAlign: 'center', fontSize: '0.85rem' }}>
              Settings saved!
            </div>
          )}
        </div>
      </div>

      <div className="glass-panel" style={{ width: '100%', maxWidth: '540px' }}>
        <h2 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
          <Save size={20} className="text-gradient" /> Data Management
        </h2>
        
        <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
          The app automatically saves a daily backup of your data. You can also manually export or import your data.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button onClick={handleExport} className="btn btn-outline" style={{ justifyContent: 'center' }}>
            <Download size={16} /> Export Data (Backup)
          </button>
          
          <button onClick={() => fileInputRef.current.click()} className="btn btn-outline" style={{ justifyContent: 'center' }}>
            <Upload size={16} /> Import Data
          </button>
          <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" style={{ display: 'none' }} />

          <button onClick={handleRestoreAutoBackup} className="btn btn-outline" style={{ justifyContent: 'center', color: 'var(--accent-warning)', borderColor: 'rgba(245,158,11,0.3)' }}>
            <RotateCcw size={16} /> Restore from Auto-Backup
          </button>

          {dataMessage && (
            <div style={{ color: 'var(--accent-success)', padding: '0.5rem', background: 'rgba(16,185,129,0.1)', borderRadius: '8px', textAlign: 'center', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              {dataMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
