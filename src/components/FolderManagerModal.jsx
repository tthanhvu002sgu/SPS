import React, { useState } from 'react';
import { X, Plus, Edit2, Trash2, Folder, Save } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const FolderManagerModal = ({ folders, addFolder, updateFolder, deleteFolder, availableTags, onClose, activeFolderId, setActiveFolderId }) => {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editTags, setEditTags] = useState([]);
  
  const handleEdit = (folder) => {
    setEditingId(folder.id);
    setEditName(folder.name);
    setEditTags(folder.tags || []);
  };
  
  const handleSave = (id) => {
    if (!editName.trim()) return;
    
    if (id === 'new') {
      const newFolder = {
        id: uuidv4(),
        name: editName.trim(),
        tags: editTags,
        wordIds: [],
      };
      addFolder(newFolder);
      setActiveFolderId(newFolder.id);
    } else {
      const folder = folders.find(f => f.id === id);
      if (folder) {
        updateFolder({ ...folder, name: editName.trim(), tags: editTags });
      }
    }
    setEditingId(null);
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

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      zIndex: 1000, display: 'grid', placeItems: 'center', padding: '1rem'
    }}>
      <div className="glass-panel" style={{
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
        
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '4px' }}>
          {folders.map(folder => (
            <div key={folder.id} style={{
              padding: '0.75rem', borderRadius: '8px',
              border: '1px solid var(--glass-border)',
              background: activeFolderId === folder.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent'
            }}>
              {editingId === folder.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <input
                    type="text"
                    className="input-field"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Tên thư mục"
                    autoFocus
                  />
                  {!folder.isDefault && (
                    <div>
                      <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>Tự động thêm từ theo Tag (Smart Folder):</p>
                      <div className="filter-chips">
                        {availableTags.length === 0 ? (
                          <span className="text-muted" style={{ fontSize: '0.8rem' }}>Chưa có tag nào trong thư viện</span>
                        ) : (
                          availableTags.map(tag => (
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
                    <button onClick={() => setEditingId(null)} className="btn btn-outline" style={{ padding: '0.4rem 0.8rem' }}>Hủy</button>
                    <button onClick={() => handleSave(folder.id)} className="btn btn-primary" style={{ padding: '0.4rem 0.8rem' }}><Save size={14} /> Lưu</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div 
                    style={{ flex: 1, cursor: 'pointer' }}
                    onClick={() => { setActiveFolderId(folder.id); onClose(); }}
                  >
                    <div style={{ fontWeight: 600, color: activeFolderId === folder.id ? 'var(--accent-primary)' : 'var(--text-main)' }}>
                      {folder.name}
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
          
          {editingId !== 'new' && (
            <button 
              onClick={() => {
                setEditingId('new');
                setEditName('');
                setEditTags([]);
              }}
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
