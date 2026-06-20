import { useState } from 'react';
import { Edit2, Trash2, Save, X, Search as SearchIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import AddWord from './AddWord';

const WordList = ({ words, settings, topics, addTopic, updateWord, deleteWord, addWord, addWords }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ word: '', meaning: '', example: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  const filteredWords = words.filter(w => 
    w.word.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (w.meaning && w.meaning.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (w.viMeaning && w.viMeaning.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (w.tags && w.tags.join(' ').toLowerCase().includes(searchTerm.toLowerCase())) ||
    (w.wordType && w.wordType.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      
      let start = Math.max(2, activePage - 1);
      let end = Math.min(totalPages - 1, activePage + 1);
      
      if (activePage <= 2) {
        end = 4;
      } else if (activePage >= totalPages - 1) {
        start = totalPages - 3;
      }
      
      if (start > 2) {
        pages.push('...');
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (end < totalPages - 1) {
        pages.push('...');
      }
      
      pages.push(totalPages);
    }
    
    return pages;
  };

  const startEdit = (word) => {
    setEditingId(word.id);
    setEditForm({ word: word.word, phonetic: word.phonetic || '', meaning: word.meaning, viMeaning: word.viMeaning || '', example: word.example || '', wordType: word.wordType || '', tags: word.tags || [] });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSave = (id) => {
    const originalWord = words.find(w => w.id === id);
    if (originalWord) {
      updateWord({
        ...originalWord,
        word: editForm.word,
        phonetic: editForm.phonetic,
        meaning: editForm.meaning,
        viMeaning: editForm.viMeaning,
        example: editForm.example,
        wordType: editForm.wordType,
        tags: editForm.tags
      });
    }
    setEditingId(null);
  };

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this word?")) {
      deleteWord(id);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', gap: '0.75rem', overflow: 'hidden' }}>
      <AddWord words={words} settings={settings} topics={topics} addTopic={addTopic} onUpdateWord={updateWord} onAdd={addWord} onAddWords={addWords} />
      
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: '0.75rem' }}>
        <div className="flex-between">
          <h2 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Word Library <span className="text-muted" style={{ fontSize: '0.85rem' }}>({words.length})</span>
          </h2>
          
          <div style={{ position: 'relative', width: '220px' }}>
            <SearchIcon size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              name="vocab_search_field"
              autoComplete="off"
              spellCheck="false"
              className="input-field" 
              placeholder="Search words..." 
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              style={{ paddingLeft: '2.2rem' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto', flex: 1, minHeight: 0, paddingRight: '4px' }}>
          {paginatedWords.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center' }}>
              <p className="text-muted">No words found.</p>
            </div>
          ) : (
            paginatedWords.map(word => (
              <div key={word.id} className="glass-panel" style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flexShrink: 0 }}>
                {editingId === word.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <input type="text" className="input-field" value={editForm.word} onChange={e => setEditForm({...editForm, word: e.target.value})} placeholder="Word" />
                    <input type="text" className="input-field" value={editForm.phonetic} onChange={e => setEditForm({...editForm, phonetic: e.target.value})} placeholder="Phonetic (e.g. /həˈləʊ/)" />
                    <input type="text" className="input-field" value={editForm.viMeaning} onChange={e => setEditForm({...editForm, viMeaning: e.target.value})} placeholder="Vietnamese Meaning" />
                    <input type="text" className="input-field" value={editForm.meaning} onChange={e => setEditForm({...editForm, meaning: e.target.value})} placeholder="English Definition" />
                    <textarea className="input-field" value={editForm.example} onChange={e => setEditForm({...editForm, example: e.target.value})} placeholder="Example sentence" rows={2} style={{ resize: 'vertical' }} />
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button onClick={cancelEdit} className="btn btn-outline" style={{ padding: '0.4rem 0.9rem' }}><X size={14}/> Cancel</button>
                      <button onClick={() => handleSave(word.id)} className="btn btn-primary" style={{ padding: '0.4rem 0.9rem' }}><Save size={14}/> Save</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: '1.1rem', color: 'var(--accent-primary)' }}>{word.word}</h3>
                        {word.phonetic && <span className="text-muted" style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>{word.phonetic}</span>}
                        {word.wordType && <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', color: 'var(--text-muted)' }}>{word.wordType}</span>}
                        {word.tags && word.tags.map(t => <span key={t} style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-secondary)', borderRadius: '4px' }}>#{t}</span>)}
                      </div>
                      {word.viMeaning && <p style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--accent-warning)', marginBottom: '0.1rem' }}>{word.viMeaning}</p>}
                      <p style={{ fontSize: '0.85rem', marginBottom: '0.2rem' }}>{word.meaning}</p>
                      {word.example && <p className="text-muted" style={{ fontStyle: 'italic', fontSize: '0.8rem' }}>"{word.example}"</p>}
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                      <button onClick={() => startEdit(word)} className="btn btn-outline" style={{ padding: '0.35rem', borderRadius: '8px' }} title="Edit"><Edit2 size={15} /></button>
                      <button onClick={() => handleDelete(word.id)} className="btn btn-outline" style={{ padding: '0.35rem', borderRadius: '8px', color: 'var(--accent-danger)', borderColor: 'rgba(239,68,68,0.3)' }} title="Delete"><Trash2 size={15} /></button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex-between" style={{ padding: '0.5rem 0', borderTop: '1px solid var(--glass-border)', gap: '1rem', flexWrap: 'wrap', flexShrink: 0 }}>
            <span className="text-muted" style={{ fontSize: '0.8rem' }}>
              Hiển thị <strong>{startIndex + 1}-{Math.min(endIndex, totalItems)}</strong> trên <strong>{totalItems}</strong> từ
            </span>
            
            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
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
                    background: pageNum === activePage ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' : pageNum === '...' ? 'transparent' : 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--glass-border)',
                    color: pageNum === activePage ? 'white' : 'var(--text-main)',
                    padding: '0.35rem 0.7rem',
                    borderRadius: '8px',
                    cursor: pageNum === '...' ? 'default' : 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: pageNum === activePage ? 700 : 500,
                    minWidth: '32px',
                    transition: 'all 0.2s ease',
                    opacity: pageNum === '...' ? 0.6 : 1
                  }}
                >
                  {pageNum}
                </button>
              ))}
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
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
    </div>
  );
};

export default WordList;
