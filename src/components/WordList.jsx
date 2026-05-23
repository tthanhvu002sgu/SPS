import { useState } from 'react';
import { Edit2, Trash2, Save, X, Search as SearchIcon } from 'lucide-react';
import AddWord from './AddWord';

const WordList = ({ words, updateWord, deleteWord, addWord }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ word: '', meaning: '', example: '' });

  const filteredWords = words.filter(w => 
    w.word.toLowerCase().includes(searchTerm.toLowerCase()) || 
    w.meaning.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const startEdit = (word) => {
    setEditingId(word.id);
    setEditForm({ word: word.word, phonetic: word.phonetic || '', meaning: word.meaning, viMeaning: word.viMeaning || '', example: word.example || '' });
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
        example: editForm.example
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
      <AddWord words={words} onAdd={addWord} />
      
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: '0.75rem' }}>
        <div className="flex-between">
          <h2 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Word Library <span className="text-muted" style={{ fontSize: '0.85rem' }}>({words.length})</span>
          </h2>
          
          <div style={{ position: 'relative', width: '220px' }}>
            <SearchIcon size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="input-field" 
              placeholder="Search words..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '2.2rem' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {filteredWords.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center' }}>
              <p className="text-muted">No words found.</p>
            </div>
          ) : (
            filteredWords.map(word => (
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
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.2rem' }}>
                        <h3 style={{ fontSize: '1.1rem', color: 'var(--accent-primary)' }}>{word.word}</h3>
                        {word.phonetic && <span className="text-muted" style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>{word.phonetic}</span>}
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
      </div>
    </div>
  );
};

export default WordList;
