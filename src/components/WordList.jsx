import { useState, useMemo, useEffect } from 'react';
import { Edit2, Trash2, Save, X, Search as SearchIcon, ChevronLeft, ChevronRight, Folder, Settings2, Filter, Tag, Download } from 'lucide-react';
import AddWord from './AddWord';
import FolderManagerModal from './FolderManagerModal';
import DataModal from './DataModal';
import { WORD_TYPES, isWordType, isStatusTag } from '../utils/tags';

const WordList = ({ words, settings, topics, folders = [], addTopic, addFolder, updateFolder, deleteFolder, updateWord, deleteWord, addWord, addWords, importData, importSnapshot, getFullSnapshotForBackup }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ word: '', meaning: '', example: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [filterTag, setFilterTag] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState(''); // '', due, mastered, new
  const [filterMissing, setFilterMissing] = useState(''); // '', 'meaning', 'example', 'phonetic'
  const [activeFolderId, setActiveFolderId] = useState('default');
  const [showFolderManager, setShowFolderManager] = useState(false);
  const [showDataModal, setShowDataModal] = useState(false);
  const ITEMS_PER_PAGE = 15;

  const availableTags = useMemo(() => {
    const set = new Set();
    words.forEach((w) => {
      (w.tags || []).forEach((t) => {
        if (t && typeof t === 'string' && t.trim()) {
          const trimmed = t.trim();
          if (!isWordType(trimmed) && !isStatusTag(trimmed)) {
            set.add(trimmed);
          }
        }
      });
    });
    return Array.from(set).sort();
  }, [words]);

  useEffect(() => {
    if (filterTag && !availableTags.includes(filterTag)) {
      setFilterTag('');
    }
  }, [availableTags, filterTag]);

  const availableTypes = useMemo(() => {
    const set = new Set();
    words.forEach((w) => {
      if (w.wordType && typeof w.wordType === 'string' && w.wordType.trim()) {
        set.add(w.wordType.trim());
      }
    });
    return Array.from(set).sort();
  }, [words]);

  useEffect(() => {
    if (filterType && !availableTypes.includes(filterType)) {
      setFilterType('');
    }
  }, [availableTypes, filterType]);

  const filteredWords = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const today = new Date().setHours(0, 0, 0, 0);
    const activeFolder = folders.find(f => f.id === activeFolderId);

    return words.filter((w) => {
      if (activeFolder && !activeFolder.isDefault) {
        const hasTag = (w.tags || []).some(t => (activeFolder.tags || []).includes(t));
        const hasType = (activeFolder.tags || []).includes(w.wordType);
        const hasId = (activeFolder.wordIds || []).includes(w.id);
        if (!hasTag && !hasType && !hasId) return false;
      }
      
      if (filterTag && !(w.tags || []).includes(filterTag)) return false;
      if (filterType && w.wordType !== filterType) return false;
      if (filterStatus === 'mastered' && !(w.repetition >= 3)) return false;
      if (filterStatus === 'new' && w.repetition !== 0) return false;
      if (filterStatus === 'due' && !(w.nextReviewDate <= today && !w.isReviewedToday)) return false;

      if (filterMissing === 'meaning' && (w.meaning || w.viMeaning)) return false;
      if (filterMissing === 'example' && w.example) return false;
      if (filterMissing === 'phonetic' && w.phonetic) return false;

      if (!q) return true;
      return (
        w.word.toLowerCase().includes(q) ||
        (w.meaning && w.meaning.toLowerCase().includes(q)) ||
        (w.viMeaning && w.viMeaning.toLowerCase().includes(q)) ||
        (w.tags && w.tags.join(' ').toLowerCase().includes(q)) ||
        (w.wordType && w.wordType.toLowerCase().includes(q))
      );
    });
  }, [words, searchTerm, filterTag, filterType, filterStatus, filterMissing, activeFolderId, folders]);

  const totalItems = filteredWords.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedWords = filteredWords.slice(startIndex, endIndex);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      let start = Math.max(2, activePage - 1);
      let end = Math.min(totalPages - 1, activePage + 1);
      if (activePage <= 2) end = 4;
      else if (activePage >= totalPages - 1) start = totalPages - 3;
      if (start > 2) pages.push('...');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const startEdit = (word) => {
    setEditingId(word.id);
    setEditForm({
      word: word.word,
      phonetic: word.phonetic || '',
      meaning: word.meaning,
      viMeaning: word.viMeaning || '',
      example: word.example || '',
      wordType: word.wordType || '',
      tags: word.tags || [],
    });
  };

  const cancelEdit = () => setEditingId(null);

  const handleSave = (id) => {
    const originalWord = words.find((w) => w.id === id);
    if (originalWord) {
      updateWord({
        ...originalWord,
        word: editForm.word,
        phonetic: editForm.phonetic,
        meaning: editForm.meaning,
        viMeaning: editForm.viMeaning,
        example: editForm.example,
        wordType: editForm.wordType,
        tags: editForm.tags,
      });
    }
    setEditingId(null);
  };

  const handleDelete = (id) => {
    if (window.confirm('Bạn có chắc muốn xóa từ này?')) {
      deleteWord(id);
    }
  };

  const resetFilters = () => {
    setFilterTag('');
    setFilterType('');
    setFilterStatus('');
    setFilterMissing('');
    setSearchTerm('');
    setCurrentPage(1);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        gap: '0.75rem',
        overflow: 'hidden',
      }}
    >
      <AddWord
        words={words}
        settings={settings}
        topics={topics}
        addTopic={addTopic}
        onUpdateWord={updateWord}
        onAdd={addWord}
        onAddWords={addWords}
      />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: '0.75rem' }}>
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              Thư viện từ{' '}
              <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                ({totalItems})
              </span>
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'var(--glass-bg)', padding: '0.25rem', borderRadius: '8px' }}>
              <select 
                value={activeFolderId} 
                onChange={(e) => setActiveFolderId(e.target.value)}
                className="input-field"
                style={{ padding: '0.25rem 0.5rem', minHeight: 'auto', fontSize: '0.85rem', width: 'auto', background: 'transparent', border: 'none' }}
              >
                {folders.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <button 
                onClick={() => setShowFolderManager(true)}
                className="btn btn-outline" 
                style={{ padding: '0.3rem', border: 'none', background: 'transparent' }} 
                title="Quản lý thư mục"
              >
                <Settings2 size={16} />
              </button>
              <button 
                onClick={() => setShowDataModal(true)}
                className="btn btn-outline" 
                style={{ padding: '0.3rem', border: 'none', background: 'transparent' }} 
                title="Nhập / Xuất dữ liệu"
              >
                <Download size={16} />
              </button>
            </div>
          </div>

          <div style={{ position: 'relative', width: 'min(220px, 100%)' }}>
            <SearchIcon
              size={15}
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              name="vocab_search_field"
              autoComplete="off"
              spellCheck="false"
              className="input-field"
              placeholder="Tìm từ..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              style={{ paddingLeft: '2.2rem' }}
            />
          </div>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          background: 'var(--glass-bg)',
          padding: '0.6rem 0.8rem',
          borderRadius: '12px',
          border: '1px solid var(--glass-border)',
        }}>
          {/* Status & Word Type Filters */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.85rem' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Filter size={14} /> Bộ lọc:
            </span>

            {/* Status Filter Dropdown */}
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="input-field"
              style={{
                padding: '0.3rem 0.75rem',
                fontSize: '0.8rem',
                width: 'auto',
                minHeight: 'auto',
                borderRadius: '8px',
                background: filterStatus ? 'rgba(59, 130, 246, 0.15)' : 'rgba(0, 0, 0, 0.05)',
                borderColor: filterStatus ? 'var(--accent-secondary)' : 'var(--glass-border)',
                color: filterStatus ? 'var(--accent-secondary)' : 'var(--text-main)',
                fontWeight: filterStatus ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              <option value="" style={{ background: 'var(--bg-dark)', color: 'var(--text-main)' }}>Trạng thái: Tất cả</option>
              <option value="due" style={{ background: 'var(--bg-dark)', color: 'var(--text-main)' }}>Đến hạn ôn tập</option>
              <option value="new" style={{ background: 'var(--bg-dark)', color: 'var(--text-main)' }}>Chưa học (mới)</option>
              <option value="mastered" style={{ background: 'var(--bg-dark)', color: 'var(--text-main)' }}>Thành thạo (SRS ≥ 3)</option>
            </select>

            {/* Word Type Filter Dropdown */}
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setCurrentPage(1);
              }}
              className="input-field"
              style={{
                padding: '0.3rem 0.75rem',
                fontSize: '0.8rem',
                width: 'auto',
                minHeight: 'auto',
                borderRadius: '8px',
                background: filterType ? 'rgba(59, 130, 246, 0.15)' : 'rgba(0, 0, 0, 0.05)',
                borderColor: filterType ? 'var(--accent-secondary)' : 'var(--glass-border)',
                color: filterType ? 'var(--accent-secondary)' : 'var(--text-main)',
                fontWeight: filterType ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              <option value="" style={{ background: 'var(--bg-dark)', color: 'var(--text-main)' }}>Từ loại: Tất cả</option>
              {availableTypes.map((t) => (
                <option key={t} value={t} style={{ background: 'var(--bg-dark)', color: 'var(--text-main)' }}>{t}</option>
              ))}
            </select>

            {/* Missing Data Filter Dropdown */}
            <select
              value={filterMissing}
              onChange={(e) => {
                setFilterMissing(e.target.value);
                setCurrentPage(1);
              }}
              className="input-field"
              style={{
                padding: '0.3rem 0.75rem',
                fontSize: '0.8rem',
                width: 'auto',
                minHeight: 'auto',
                borderRadius: '8px',
                background: filterMissing ? 'rgba(59, 130, 246, 0.15)' : 'rgba(0, 0, 0, 0.05)',
                borderColor: filterMissing ? 'var(--accent-secondary)' : 'var(--glass-border)',
                color: filterMissing ? 'var(--accent-secondary)' : 'var(--text-main)',
                fontWeight: filterMissing ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              <option value="" style={{ background: 'var(--bg-dark)', color: 'var(--text-main)' }}>Dữ liệu: Đầy đủ/Tất cả</option>
              <option value="meaning" style={{ background: 'var(--bg-dark)', color: 'var(--text-main)' }}>Thiếu nghĩa</option>
              <option value="example" style={{ background: 'var(--bg-dark)', color: 'var(--text-main)' }}>Thiếu câu ví dụ</option>
              <option value="phonetic" style={{ background: 'var(--bg-dark)', color: 'var(--text-main)' }}>Thiếu phiên âm</option>
            </select>

            {(filterStatus || filterType || filterTag || filterMissing || searchTerm) && (
              <button
                type="button"
                onClick={resetFilters}
                className="btn btn-outline"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '6px', marginLeft: 'auto' }}
              >
                <X size={12} /> Đặt lại
              </button>
            )}
          </div>

          {/* Topic Tags Row */}
          {availableTags.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem', paddingTop: '0.4rem', borderTop: '1px dashed var(--glass-border)' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', marginRight: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <Tag size={12} /> Chủ đề:
              </span>
              <button
                type="button"
                className={`chip ${!filterTag ? 'chip-active' : ''}`}
                onClick={() => {
                  setFilterTag('');
                  setCurrentPage(1);
                }}
                style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem' }}
              >
                Tất cả chủ đề
              </button>
              {availableTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`chip ${filterTag === t ? 'chip-active' : ''}`}
                  onClick={() => {
                    setFilterTag(filterTag === t ? '' : t);
                    setCurrentPage(1);
                  }}
                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem' }}
                >
                  #{t}
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            overflowY: 'auto',
            flex: 1,
            minHeight: 0,
            paddingRight: '4px',
          }}
        >
          {paginatedWords.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center' }}>
              <p style={{ fontWeight: 600, marginBottom: '0.35rem' }}>
                {words.length === 0 ? 'Thư viện trống' : 'Không tìm thấy từ nào'}
              </p>
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                {words.length === 0
                  ? 'Thêm từ thủ công, nhanh, hoặc import Excel/CSV ở phía trên.'
                  : 'Thử đổi bộ lọc hoặc từ khóa tìm kiếm.'}
              </p>
            </div>
          ) : (
            paginatedWords.map((word) => (
              <div
                key={word.id}
                className="glass-panel"
                style={{
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  flexShrink: 0,
                }}
              >
                {editingId === word.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <input
                      type="text"
                      className="input-field"
                      value={editForm.word}
                      onChange={(e) => setEditForm({ ...editForm, word: e.target.value })}
                      placeholder="Từ"
                    />
                    <input
                      type="text"
                      className="input-field"
                      value={editForm.phonetic}
                      onChange={(e) => setEditForm({ ...editForm, phonetic: e.target.value })}
                      placeholder="Phiên âm (vd: /həˈləʊ/)"
                    />
                    <input
                      type="text"
                      className="input-field"
                      value={editForm.viMeaning}
                      onChange={(e) => setEditForm({ ...editForm, viMeaning: e.target.value })}
                      placeholder="Nghĩa tiếng Việt"
                    />
                    <input
                      type="text"
                      className="input-field"
                      value={editForm.meaning}
                      onChange={(e) => setEditForm({ ...editForm, meaning: e.target.value })}
                      placeholder="Định nghĩa tiếng Anh"
                    />
                    <textarea
                      className="input-field"
                      value={editForm.example}
                      onChange={(e) => setEditForm({ ...editForm, example: e.target.value })}
                      placeholder="Câu ví dụ"
                      rows={2}
                      style={{ resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button onClick={cancelEdit} className="btn btn-outline" style={{ padding: '0.4rem 0.9rem' }}>
                        <X size={14} /> Hủy
                      </button>
                      <button
                        onClick={() => handleSave(word.id)}
                        className="btn btn-primary"
                        style={{ padding: '0.4rem 0.9rem' }}
                      >
                        <Save size={14} /> Lưu
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '1rem',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: '0.5rem',
                          marginBottom: '0.2rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        <h3 style={{ fontSize: '1.1rem', color: 'var(--accent-primary)' }}>{word.word}</h3>
                        {word.phonetic && (
                          <span className="text-muted" style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>
                            {word.phonetic}
                          </span>
                        )}
                        {word.wordType && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              padding: '0.1rem 0.4rem',
                              background: 'rgba(128,128,128,0.12)',
                              borderRadius: '4px',
                              color: 'var(--text-muted)',
                            }}
                          >
                            {word.wordType}
                          </span>
                        )}
                        {word.tags &&
                          word.tags.map((t) => (
                            <span
                              key={t}
                              style={{
                                fontSize: '0.7rem',
                                padding: '0.1rem 0.4rem',
                                background: 'rgba(59, 130, 246, 0.12)',
                                color: 'var(--accent-secondary)',
                                borderRadius: '4px',
                              }}
                            >
                              #{t}
                            </span>
                          ))}
                      </div>
                      {word.viMeaning && (
                        <p
                          style={{
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            color: 'var(--accent-warning)',
                            marginBottom: '0.1rem',
                          }}
                        >
                          {word.viMeaning}
                        </p>
                      )}
                      <p style={{ fontSize: '0.85rem', marginBottom: '0.2rem' }}>{word.meaning}</p>
                      {word.example && (
                        <p className="text-muted" style={{ fontStyle: 'italic', fontSize: '0.8rem' }}>
                          &ldquo;{word.example}&rdquo;
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                      <button
                        onClick={() => startEdit(word)}
                        className="btn btn-outline"
                        style={{ padding: '0.35rem', borderRadius: '8px' }}
                        title="Sửa"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(word.id)}
                        className="btn btn-outline"
                        style={{
                          padding: '0.35rem',
                          borderRadius: '8px',
                          color: 'var(--accent-danger)',
                          borderColor: 'rgba(239,68,68,0.3)',
                        }}
                        title="Xóa"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div
            className="flex-between"
            style={{
              padding: '0.5rem 0',
              borderTop: '1px solid var(--glass-border)',
              gap: '1rem',
              flexWrap: 'wrap',
              flexShrink: 0,
            }}
          >
            <span className="text-muted" style={{ fontSize: '0.8rem' }}>
              Hiển thị <strong>{startIndex + 1}-{Math.min(endIndex, totalItems)}</strong> /{' '}
              <strong>{totalItems}</strong> từ
            </span>

            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={activePage === 1}
                className="btn btn-outline"
                style={{ padding: '0.35rem 0.6rem', borderRadius: '8px', fontSize: '0.8rem' }}
              >
                <ChevronLeft size={14} />
              </button>

              {getPageNumbers().map((pageNum, idx) => (
                <button
                  key={idx}
                  onClick={() => typeof pageNum === 'number' && setCurrentPage(pageNum)}
                  disabled={pageNum === '...'}
                  style={{
                    background:
                      pageNum === activePage
                        ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))'
                        : pageNum === '...'
                          ? 'transparent'
                          : 'rgba(128,128,128,0.06)',
                    border: '1px solid var(--glass-border)',
                    color: pageNum === activePage ? 'white' : 'var(--text-main)',
                    padding: '0.35rem 0.7rem',
                    borderRadius: '8px',
                    cursor: pageNum === '...' ? 'default' : 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: pageNum === activePage ? 700 : 500,
                    minWidth: '32px',
                    opacity: pageNum === '...' ? 0.6 : 1,
                  }}
                >
                  {pageNum}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={activePage === totalPages}
                className="btn btn-outline"
                style={{ padding: '0.35rem 0.6rem', borderRadius: '8px', fontSize: '0.8rem' }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showFolderManager && (
        <FolderManagerModal 
          words={words}
          folders={folders}
          addFolder={addFolder}
          updateFolder={updateFolder}
          deleteFolder={deleteFolder}
          availableTags={availableTags}
          activeFolderId={activeFolderId}
          setActiveFolderId={setActiveFolderId}
          onClose={() => setShowFolderManager(false)}
        />
      )}

      {showDataModal && (
        <DataModal
          words={words}
          filteredWords={filteredWords}
          importData={importData}
          importSnapshot={importSnapshot}
          getFullSnapshotForBackup={getFullSnapshotForBackup}
          onClose={() => setShowDataModal(false)}
        />
      )}
    </div>
  );
};

export default WordList;
