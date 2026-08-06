import React, { useState } from 'react';
import { X, Plus, Edit2, Trash2, Folder, Save, AlertCircle } from 'lucide-react';

const FolderManagerModal = ({ words = [], folders = [], addFolder, updateFolder, deleteFolder, availableTags = [], onClose, activeFolderId, setActiveFolderId }) => {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editTags, setEditTags] = useState([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [error, setError] = useState('');

  const generateFolderId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'folder_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  };

  const getFolderWordCount = (folder) => {
    if (folder.isDefault) return words.length;
    return words.filter((w) => {
      const hasTag = (w.tags || []).some(t => (folder.tags || []).includes(t));
      const hasType = (folder.tags || []).includes(w.wordType);
      const hasId = (folder.wordIds || []).includes(w.id);
      return hasTag || hasType || hasId;
    }).length;
  };

  const handleStartCreate = () => {
    setEditingId('new');
    setEditName('');
    setEditTags([]);
    setCustomTagInput('');
    setError('');
  };

  const handleEdit = (folder) => {
    setEditingId(folder.id);
    setEditName(folder.name);
    setEditTags(folder.tags || []);
    setCustomTagInput('');
    setError('');
  };

  const handleAddCustomTag = () => {
    const tag = customTagInput.trim().replace(/^#/, '');
    if (!tag) return;
    if (!editTags.includes(tag)) {
      setEditTags(prev => [...prev, tag]);
    }
    setCustomTagInput('');
  };

  const handleSave = (id) => {
    const trimmedName = editName.trim();
    if (!trimmedName) {
      setError('Vui lòng nhập tên thư mục.');
      return;
    }

    const isDuplicate = folders.some(
      f => f.id !== id && f.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      setError('Thư mục có tên này đã tồn tại.');
      return;
    }

    setError('');

    if (id === 'new') {
      const newFolder = {
        id: generateFolderId(),
        name: trimmedName,
        tags: editTags,
        wordIds: [],
      };
      addFolder(newFolder);
      setActiveFolderId(newFolder.id);
      setEditingId(null);
      setEditName('');
      setEditTags([]);
      onClose();
    } else {
      const folder = folders.find(f => f.id === id);
      if (folder) {
        updateFolder({ ...folder, name: trimmedName, tags: editTags });
      }
      setEditingId(null);
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Bạn có chắc muốn xóa thư mục này? (Các từ vựng bên trong sẽ không bị xóa)')) {
      deleteFolder(id);
      if (activeFolderId === id) {
        setActiveFolderId('default');
      }
    }
  };

  const toggleTag = (tag) => {
    setEditTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const combinedTags = Array.from(new Set([...availableTags, ...editTags])).sort();

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
      zIndex: 1000, display: 'grid', placeItems: 'center', padding: '1rem'
    }}>
      <div className="modal-panel" style={{
        width: '100%', maxWidth: '500px', maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', gap: '1rem',
        padding: '1.5rem', overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '1.2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Folder size={20} className="text-gradient" /> Quản lý Thư mục
          </h2>
          <button onClick={onClose} className="btn btn-outline" style={{ padding: '0.4rem' }}>
            <X size={16} />
          </button>
        </div>

        {error && (
          <div style={{
            padding: '0.6rem 0.8rem', borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '4px' }}>
          {folders.map(folder => (
            <div key={folder.id} className={`folder-item ${activeFolderId === folder.id ? 'folder-item-active' : ''}`}>
              {editingId === folder.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <input
                    type="text"
                    className="input-field"
                    value={editName}
                    onChange={e => { setEditName(e.target.value); setError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') handleSave(folder.id); }}
                    placeholder="Tên thư mục"
                    autoFocus
                  />
                  {!folder.isDefault && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <p style={{ fontSize: '0.85rem', margin: 0 }}>Tự động thêm từ theo Tag (Smart Folder):</p>
                      
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <input
                          type="text"
                          className="input-field"
                          value={customTagInput}
                          onChange={e => setCustomTagInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomTag(); } }}
                          placeholder="Thêm tag mới..."
                          style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomTag}
                          className="btn btn-outline"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', flexShrink: 0 }}
                        >
                          <Plus size={14} /> Thêm tag
                        </button>
                      </div>

                      <div className="filter-chips">
                        {combinedTags.length === 0 ? (
                          <span className="text-muted" style={{ fontSize: '0.8rem' }}>Chưa có tag nào trong thư viện</span>
                        ) : (
                          combinedTags.map(tag => (
                            <button
                              key={tag}
                              type="button"
                              className={`chip ${editTags.includes(tag) ? 'chip-active' : ''}`}
                              onClick={() => toggleTag(tag)}
                            >
                              #{tag}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button onClick={() => { setEditingId(null); setError(''); }} className="btn btn-outline" style={{ padding: '0.4rem 0.8rem' }}>Hủy</button>
                    <button onClick={() => handleSave(folder.id)} className="btn btn-primary" style={{ padding: '0.4rem 0.8rem' }}><Save size={14} /> Lưu</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div 
                    style={{ flex: 1, cursor: 'pointer' }}
                    onClick={() => { setActiveFolderId(folder.id); onClose(); }}
                  >
                    <div style={{ fontWeight: 600, color: activeFolderId === folder.id ? 'var(--accent-primary)' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {folder.name}
                      <span className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 'normal' }}>
                        ({getFolderWordCount(folder)} từ)
                      </span>
                    </div>
                    {!folder.isDefault && folder.tags && folder.tags.length > 0 && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Tags: {folder.tags.map(t => `#${t}`).join(', ')}
                      </div>
                    )}
                    {folder.isDefault && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Tất cả từ vựng
                      </div>
                    )}
                  </div>
                  
                  {!folder.isDefault && (
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button onClick={() => handleEdit(folder)} className="btn btn-outline" style={{ padding: '0.3rem' }} title="Sửa">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete(folder.id)} className="btn btn-outline" style={{ padding: '0.3rem', color: 'var(--accent-danger)', borderColor: 'rgba(239,68,68,0.3)' }} title="Xóa">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          
          {editingId === 'new' ? (
            <div style={{
              padding: '0.75rem', borderRadius: '8px',
              border: '1px dashed var(--accent-primary)',
              background: 'rgba(59, 130, 246, 0.05)',
              display: 'flex', flexDirection: 'column', gap: '0.75rem'
            }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Tạo thư mục mới</h4>
              <input
                type="text"
                className="input-field"
                value={editName}
                onChange={e => { setEditName(e.target.value); setError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handleSave('new'); }}
                placeholder="Nhập tên thư mục..."
                autoFocus
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <p style={{ fontSize: '0.85rem', margin: 0 }}>Tự động thêm từ theo Tag (Smart Folder):</p>
                
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <input
                    type="text"
                    className="input-field"
                    value={customTagInput}
                    onChange={e => setCustomTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomTag(); } }}
                    placeholder="Thêm tag mới..."
                    style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomTag}
                    className="btn btn-outline"
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', flexShrink: 0 }}
                  >
                    <Plus size={14} /> Thêm tag
                  </button>
                </div>

                <div className="filter-chips">
                  {combinedTags.length === 0 ? (
                    <span className="text-muted" style={{ fontSize: '0.8rem' }}>Chưa có tag nào trong thư viện</span>
                  ) : (
                    combinedTags.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        className={`chip ${editTags.includes(tag) ? 'chip-active' : ''}`}
                        onClick={() => toggleTag(tag)}
                      >
                        #{tag}
                      </button>
                    ))
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button onClick={() => { setEditingId(null); setError(''); }} className="btn btn-outline" style={{ padding: '0.4rem 0.8rem' }}>Hủy</button>
                <button onClick={() => handleSave('new')} className="btn btn-primary" style={{ padding: '0.4rem 0.8rem' }}><Save size={14} /> Lưu thư mục</button>
              </div>
            </div>
          ) : (
            <button 
              onClick={handleStartCreate}
              className="btn btn-outline"
              style={{ padding: '0.75rem', borderStyle: 'dashed', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
            >
              <Plus size={16} /> Tạo thư mục mới
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FolderManagerModal;

