import { useState, useMemo, useEffect } from 'react';
import { Edit2, Trash2, Save, X, Search as SearchIcon, ChevronLeft, ChevronRight, Folder, Settings2, Filter, Tag, Download, Sparkles, Layers, Plus } from 'lucide-react';
import AddWord from './AddWord';
import FolderManagerModal from './FolderManagerModal';
import DataModal from './DataModal';
import EnrichModal from './EnrichModal';
import { isWordType, isStatusTag } from '../utils/tags';
import { formatLineBreaks } from '../utils/formatText';

const WordList = ({
  words,
  settings,
  topics,
  folders = [],
  addTopic,
  addFolder,
  updateFolder,
  deleteFolder,
  updateWord,
  batchUpdateWords,
  deleteWord,
  addWord,
  addWords,
  importData,
  importSnapshot,
  getFullSnapshotForBackup
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ word: '', meaning: '', viMeaning: '', example: '', collocations: '', phonetic: '', wordType: '', tags: [] });
  const [currentPage, setCurrentPage] = useState(1);
  const [filterTag, setFilterTag] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState(''); // '', due, mastered, new
  const [filterMissing, setFilterMissing] = useState(''); // '', 'meaning', 'example', 'phonetic', 'collocations'
  const [activeFolderId, setActiveFolderId] = useState('default');
  const [isAddOpen, setIsAddOpen] = useState(words.length === 0);
  const [showFolderManager, setShowFolderManager] = useState(false);
  const [showDataModal, setShowDataModal] = useState(false);
  const [showEnrichModal, setShowEnrichModal] = useState(false);
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
      if (filterMissing === 'collocations' && w.collocations && w.collocations.length > 0) return false;

      if (!q) return true;
      return (
        w.word.toLowerCase().includes(q) ||
        (w.meaning && w.meaning.toLowerCase().includes(q)) ||
        (w.viMeaning && w.viMeaning.toLowerCase().includes(q)) ||
        (w.collocations && w.collocations.join(' ').toLowerCase().includes(q)) ||
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
      meaning: word.meaning || '',
      viMeaning: word.viMeaning || '',
      example: word.example || '',
      collocations: Array.isArray(word.collocations) ? word.collocations.join('\n') : (word.collocations || ''),
      wordType: word.wordType || '',
      tags: word.tags || [],
    });
  };

  const cancelEdit = () => setEditingId(null);

  const handleSave = (id) => {
    const originalWord = words.find((w) => w.id === id);
    if (originalWord) {
      const parsedCollocations = (editForm.collocations || '')
        .split(/[\n,;•·|]+/)
        .map((c) => c.trim())
        .filter(Boolean);

      updateWord({
        ...originalWord,
        word: editForm.word,
        phonetic: editForm.phonetic,
        meaning: editForm.meaning,
        viMeaning: editForm.viMeaning,
        example: editForm.example,
        collocations: parsedCollocations,
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

  const hasActiveFilters = Boolean(filterStatus || filterType || filterTag || filterMissing || searchTerm);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        gap: '0.65rem',
        overflow: 'hidden',
      }}
    >
      {/* 1. Header Toolbar (Minimalist & Compact) */}
      <div
        className="vocab-card-minimal"
        style={{
          padding: '0.65rem 0.9rem',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.6rem',
        }}
      >
        {/* Left: Title + Counter + Folder + Toggle Add Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <h2 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700, letterSpacing: '-0.01em' }}>
              Thư viện từ
            </h2>
            <span className="badge-pastel badge-pastel-gray" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
              {totalItems.toLocaleString()} từ
            </span>
          </div>

          {/* Folder Switcher */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              background: 'rgba(0,0,0,0.05)',
              padding: '0.15rem 0.4rem',
              borderRadius: '8px',
              border: '1px solid var(--glass-border)',
            }}
          >
            <Folder size={13} style={{ color: 'var(--text-muted)' }} />
            <select
              value={activeFolderId}
              onChange={(e) => {
                setActiveFolderId(e.target.value);
                setCurrentPage(1);
              }}
              className="input-field"
              style={{
                padding: '0.2rem 0.35rem',
                minHeight: 'auto',
                fontSize: '0.8rem',
                width: 'auto',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              {folders.map((f) => (
                <option key={f.id} value={f.id} style={{ background: 'var(--bg-dark)', color: 'var(--text-main)' }}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Collapsible Add Button */}
          <button
            type="button"
            onClick={() => setIsAddOpen((prev) => !prev)}
            className={`btn ${isAddOpen ? 'btn-outline' : 'btn-primary'}`}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              borderRadius: '8px',
              fontWeight: 600,
              gap: '0.3rem',
            }}
          >
            <Plus
              size={14}
              style={{
                transform: isAddOpen ? 'rotate(45deg)' : 'none',
                transition: 'transform 0.2s ease',
              }}
            />
            <span>{isAddOpen ? 'Đóng thêm từ' : 'Thêm từ'}</span>
          </button>
        </div>

        {/* Right: Search Box + Action Tools */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          {/* Quick Search */}
          <div style={{ position: 'relative', width: 'min(190px, 100%)' }}>
            <SearchIcon
              size={13}
              style={{
                position: 'absolute',
                left: '0.65rem',
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
              placeholder="Tìm từ, nghĩa..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                paddingLeft: '1.9rem',
                paddingRight: searchTerm ? '1.8rem' : '0.65rem',
                paddingTop: '0.35rem',
                paddingBottom: '0.35rem',
                fontSize: '0.8rem',
                borderRadius: '8px',
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                style={{
                  position: 'absolute',
                  right: '0.5rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Action: Enrich Data */}
          <button
            onClick={() => setShowEnrichModal(true)}
            className="btn btn-outline"
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.78rem',
              borderRadius: '8px',
              background: 'var(--pastel-blue-bg)',
              color: 'var(--pastel-blue-text)',
              borderColor: 'rgba(59, 130, 246, 0.3)',
              fontWeight: 600,
            }}
            title="Tự động điền 3 Collocations, ví dụ và nghĩa tiếng Việt"
          >
            <Sparkles size={13} />
            <span>Điền dữ liệu</span>
          </button>

          {/* Action: Data Modal (Export / Import) */}
          <button
            onClick={() => setShowDataModal(true)}
            className="btn btn-outline"
            style={{ padding: '0.35rem 0.6rem', fontSize: '0.78rem', borderRadius: '8px' }}
            title="Nhập / Xuất dữ liệu"
          >
            <Download size={13} />
            <span>Dữ liệu</span>
          </button>

          {/* Action: Folder Manager */}
          <button
            onClick={() => setShowFolderManager(true)}
            className="btn btn-outline"
            style={{ padding: '0.35rem 0.45rem', borderRadius: '8px' }}
            title="Quản lý thư mục"
          >
            <Settings2 size={14} />
          </button>
        </div>
      </div>

      {/* 2. Collapsible Add Word Section */}
      {isAddOpen && (
        <div className="animate-fade-in" style={{ flexShrink: 0 }}>
          <AddWord
            words={words}
            settings={settings}
            topics={topics}
            addTopic={addTopic}
            onUpdateWord={updateWord}
            onAdd={addWord}
            onAddWords={addWords}
            onClose={() => setIsAddOpen(false)}
          />
        </div>
      )}

      {/* 3. Filter Bar & Horizontal Topic Scroll */}
      <div
        className="vocab-card-minimal"
        style={{
          padding: '0.55rem 0.85rem',
          gap: '0.45rem',
          background: 'var(--glass-bg)',
        }}
      >
        {/* Row 1: Dropdown filters + Reset button */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.45rem', fontSize: '0.8rem' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <Filter size={12} /> Bộ lọc:
          </span>

          {/* Status Dropdown */}
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="input-field"
            style={{
              padding: '0.25rem 0.55rem',
              fontSize: '0.78rem',
              width: 'auto',
              minHeight: 'auto',
              borderRadius: '6px',
              background: filterStatus ? 'var(--pastel-blue-bg)' : 'rgba(0, 0, 0, 0.04)',
              borderColor: filterStatus ? 'var(--pastel-blue-text)' : 'var(--glass-border)',
              color: filterStatus ? 'var(--pastel-blue-text)' : 'var(--text-main)',
              fontWeight: filterStatus ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            <option value="" style={{ background: 'var(--bg-dark)', color: 'var(--text-main)' }}>Trạng thái: Tất cả</option>
            <option value="due" style={{ background: 'var(--bg-dark)', color: 'var(--text-main)' }}>Đến hạn ôn tập</option>
            <option value="new" style={{ background: 'var(--bg-dark)', color: 'var(--text-main)' }}>Chưa học (mới)</option>
            <option value="mastered" style={{ background: 'var(--bg-dark)', color: 'var(--text-main)' }}>Thành thạo (SRS ≥ 3)</option>
          </select>

          {/* Word Type Dropdown */}
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setCurrentPage(1);
            }}
            className="input-field"
            style={{
              padding: '0.25rem 0.55rem',
              fontSize: '0.78rem',
              width: 'auto',
              minHeight: 'auto',
              borderRadius: '6px',
              background: filterType ? 'var(--pastel-blue-bg)' : 'rgba(0, 0, 0, 0.04)',
              borderColor: filterType ? 'var(--pastel-blue-text)' : 'var(--glass-border)',
              color: filterType ? 'var(--pastel-blue-text)' : 'var(--text-main)',
              fontWeight: filterType ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            <option value="" style={{ background: 'var(--bg-dark)', color: 'var(--text-main)' }}>Từ loại: Tất cả</option>
            {availableTypes.map((t) => (
              <option key={t} value={t} style={{ background: 'var(--bg-dark)', color: 'var(--text-main)' }}>{t}</option>
            ))}
          </select>

          {/* Missing Data Dropdown */}
          <select
            value={filterMissing}
            onChange={(e) => {
              setFilterMissing(e.target.value);
              setCurrentPage(1);
            }}
            className="input-field"
            style={{
              padding: '0.25rem 0.55rem',
              fontSize: '0.78rem',
              width: 'auto',
              minHeight: 'auto',
              borderRadius: '6px',
              background: filterMissing ? 'var(--pastel-yellow-bg)' : 'rgba(0, 0, 0, 0.04)',
              borderColor: filterMissing ? 'var(--pastel-yellow-text)' : 'var(--glass-border)',
              color: filterMissing ? 'var(--pastel-yellow-text)' : 'var(--text-main)',
              fontWeight: filterMissing ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            <option value="" style={{ background: 'var(--bg-dark)', color: 'var(--text-main)' }}>Dữ liệu: Đầy đủ/Tất cả</option>
            <option value="collocations" style={{ background: 'var(--bg-dark)', color: 'var(--text-main)' }}>Thiếu Collocations</option>
            <option value="meaning" style={{ background: 'var(--bg-dark)', color: 'var(--text-main)' }}>Thiếu nghĩa</option>
            <option value="example" style={{ background: 'var(--bg-dark)', color: 'var(--text-main)' }}>Thiếu câu ví dụ</option>
            <option value="phonetic" style={{ background: 'var(--bg-dark)', color: 'var(--text-main)' }}>Thiếu phiên âm</option>
          </select>

          {/* Active Reset Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="btn btn-outline"
              style={{
                padding: '0.2rem 0.45rem',
                fontSize: '0.72rem',
                borderRadius: '6px',
                marginLeft: 'auto',
                color: 'var(--accent-danger)',
                borderColor: 'rgba(239,68,68,0.3)',
              }}
            >
              <X size={11} /> Đặt lại
            </button>
          )}
        </div>

        {/* Row 2: Horizontal Scrollable Topic Tags */}
        {availableTags.length > 0 && (
          <div
            className="horizontal-scroll-chips"
            style={{
              paddingTop: '0.35rem',
              borderTop: '1px solid var(--glass-border)',
            }}
          >
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', paddingRight: '0.2rem' }}>
              <Tag size={11} /> Chủ đề:
            </span>
            <button
              type="button"
              className={`chip ${!filterTag ? 'chip-active' : ''}`}
              onClick={() => {
                setFilterTag('');
                setCurrentPage(1);
              }}
              style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', height: '24px', flexShrink: 0 }}
            >
              Tất cả
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
                style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', height: '24px', flexShrink: 0 }}
              >
                #{t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 4. Vocabulary Word List (Main Center Area) */}
      <div
        className="no-scrollbar"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.45rem',
          overflowY: 'auto',
          flex: 1,
          minHeight: 0,
          paddingRight: '2px',
        }}
      >
        {paginatedWords.length === 0 ? (
          <div className="vocab-card-minimal" style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
            <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.35rem' }}>
              {words.length === 0 ? 'Thư viện trống' : 'Không tìm thấy từ vựng phù hợp'}
            </p>
            <p className="text-muted" style={{ fontSize: '0.85rem', maxWidth: '400px', margin: '0 auto' }}>
              {words.length === 0
                ? 'Bấm nút "Thêm từ" ở góc trên để bắt đầu thêm từ mới hoặc nhập file Excel/CSV.'
                : 'Thử điều chỉnh bộ lọc hoặc xóa từ khóa tìm kiếm để xem các từ khác.'}
            </p>
          </div>
        ) : (
          paginatedWords.map((word) => (
            <div
              key={word.id}
              className="vocab-card-minimal animate-fade-in"
            >
              {editingId === word.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <input
                      type="text"
                      className="input-field"
                      value={editForm.word}
                      onChange={(e) => setEditForm({ ...editForm, word: e.target.value })}
                      placeholder="Từ vựng"
                    />
                    <input
                      type="text"
                      className="input-field"
                      value={editForm.phonetic}
                      onChange={(e) => setEditForm({ ...editForm, phonetic: e.target.value })}
                      placeholder="Phiên âm (vd: /həˈləʊ/)"
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
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
                  </div>
                  <textarea
                    className="input-field"
                    value={editForm.collocations}
                    onChange={(e) => setEditForm({ ...editForm, collocations: e.target.value })}
                    placeholder="3 Collocations tiếng Anh (mỗi cụm 1 dòng hoặc cách nhau dấu phẩy)"
                    rows={2}
                    style={{ resize: 'vertical' }}
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
                    <button onClick={cancelEdit} className="btn btn-outline" style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem' }}>
                      <X size={13} /> Hủy
                    </button>
                    <button
                      onClick={() => handleSave(word.id)}
                      className="btn btn-primary"
                      style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem' }}
                    >
                      <Save size={13} /> Lưu
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                  }}
                >
                  {/* Left content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Header line: Word + IPA + Type + Tags */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '0.45rem',
                        marginBottom: '0.25rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--accent-primary)' }}>
                        {word.word}
                      </h3>
                      {word.phonetic && (
                        <span className="text-muted" style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>
                          {word.phonetic}
                        </span>
                      )}
                      {word.wordType && (
                        <span className="badge-pastel badge-pastel-gray">
                          {word.wordType}
                        </span>
                      )}
                      {word.tags &&
                        word.tags.map((t) => (
                          <span key={t} className="badge-pastel badge-pastel-blue">
                            #{t}
                          </span>
                        ))}
                    </div>

                    {/* Vietnamese translation (High contrast / clear) */}
                    {word.viMeaning && (
                      <p
                        className="preserve-newlines"
                        style={{
                          fontWeight: 600,
                          fontSize: '0.88rem',
                          color: 'var(--accent-warning)',
                          marginBottom: '0.15rem',
                          lineHeight: '1.4',
                        }}
                      >
                        {formatLineBreaks(word.viMeaning)}
                      </p>
                    )}

                    {/* English definition */}
                    {word.meaning && (
                      <p
                        className="preserve-newlines"
                        style={{
                          fontSize: '0.82rem',
                          color: 'var(--text-main)',
                          opacity: 0.9,
                          marginBottom: '0.25rem',
                          lineHeight: '1.4',
                        }}
                      >
                        {formatLineBreaks(word.meaning)}
                      </p>
                    )}

                    {/* Collocations */}
                    {word.collocations && word.collocations.length > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: '0.3rem',
                          margin: '0.2rem 0',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <Layers size={11} /> Collocations:
                        </span>
                        {word.collocations.map((c, i) => (
                          <span key={i} className="badge-pastel badge-pastel-green">
                            {c}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Example sentence */}
                    {word.example && (
                      <p
                        className="preserve-newlines text-muted"
                        style={{
                          fontStyle: 'italic',
                          fontSize: '0.78rem',
                          marginTop: '0.2rem',
                          lineHeight: '1.4',
                        }}
                      >
                        &ldquo;{formatLineBreaks(word.example)}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Right actions: Edit & Delete */}
                  <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0, marginTop: '2px' }}>
                    <button
                      onClick={() => startEdit(word)}
                      className="btn btn-outline"
                      style={{ padding: '0.3rem 0.35rem', borderRadius: '6px' }}
                      title="Sửa từ"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(word.id)}
                      className="btn btn-outline"
                      style={{
                        padding: '0.3rem 0.35rem',
                        borderRadius: '6px',
                        color: 'var(--accent-danger)',
                        borderColor: 'rgba(239,68,68,0.3)',
                      }}
                      title="Xóa từ"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 5. Minimalist Pagination Bar */}
      {totalPages > 1 && (
        <div
          className="flex-between"
          style={{
            padding: '0.35rem 0.25rem',
            borderTop: '1px solid var(--glass-border)',
            gap: '0.75rem',
            flexWrap: 'wrap',
            flexShrink: 0,
          }}
        >
          <span className="text-muted" style={{ fontSize: '0.78rem' }}>
            Hiển thị <strong>{startIndex + 1}-{Math.min(endIndex, totalItems)}</strong> /{' '}
            <strong>{totalItems.toLocaleString()}</strong> từ
          </span>

          <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={activePage === 1}
              className="btn btn-outline"
              style={{ padding: '0.25rem 0.45rem', borderRadius: '6px', fontSize: '0.75rem' }}
            >
              <ChevronLeft size={13} />
            </button>

            {getPageNumbers().map((pageNum, idx) => (
              <button
                key={idx}
                onClick={() => typeof pageNum === 'number' && setCurrentPage(pageNum)}
                disabled={pageNum === '...'}
                className={`btn ${activePage === pageNum ? 'btn-primary' : 'btn-outline'}`}
                style={{
                  padding: '0.25rem 0.55rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  minWidth: '28px',
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
              style={{ padding: '0.25rem 0.45rem', borderRadius: '6px', fontSize: '0.75rem' }}
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
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

      {showEnrichModal && (
        <EnrichModal
          isOpen={showEnrichModal}
          onClose={() => setShowEnrichModal(false)}
          words={words}
          filteredWords={filteredWords}
          onBatchUpdate={(updated) => {
            if (batchUpdateWords) batchUpdateWords(updated);
          }}
        />
      )}
    </div>
  );
};

export default WordList;

