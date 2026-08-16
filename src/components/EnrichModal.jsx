import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Check, Loader2, Play, Square, Layers, BookOpen, Volume2, Globe, AlertCircle } from 'lucide-react';
import { enrichWordsBatch } from '../utils/enrichVocab';

const EnrichModal = ({ isOpen, onClose, words = [], filteredWords = [], onBatchUpdate }) => {
  const [scope, setScope] = useState('missing'); // 'missing' | 'filtered' | 'all'
  const [fillCollocations, setFillCollocations] = useState(true);
  const [fillExample, setFillExample] = useState(true);
  const [fillViMeaning, setFillViMeaning] = useState(true);
  const [fillPhoneticAndMeaning, setFillPhoneticAndMeaning] = useState(true);
  const [forceOverwrite, setForceOverwrite] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, activeWord: '', percent: 0 });
  const [resultSummary, setResultSummary] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const isCancelledRef = useRef(false);
  const enrichedCountRef = useRef(0);

  // Field-specific missing checkers
  const isMissingCollocations = (w) => !w.collocations || !Array.isArray(w.collocations) || w.collocations.length === 0;
  const isMissingExample = (w) => !w.example || !w.example.trim();
  const isMissingViMeaning = (w) => !w.viMeaning || !w.viMeaning.trim();
  const isMissingPhoneticAndMeaning = (w) => (!w.phonetic || !w.phonetic.trim()) || (!w.meaning || !w.meaning.trim());

  // Individual breakdown counts across library
  const missingCollocationsCount = words.filter(isMissingCollocations).length;
  const missingExampleCount = words.filter(isMissingExample).length;
  const missingViMeaningCount = words.filter(isMissingViMeaning).length;
  const missingPhoneticAndMeaningCount = words.filter(isMissingPhoneticAndMeaning).length;

  // Dynamic predicate checking if a word lacks any of the SELECTED fields
  const isMissingBySelectedOptions = (w) => {
    if (fillCollocations && isMissingCollocations(w)) return true;
    if (fillExample && isMissingExample(w)) return true;
    if (fillViMeaning && isMissingViMeaning(w)) return true;
    if (fillPhoneticAndMeaning && isMissingPhoneticAndMeaning(w)) return true;
    return false;
  };

  const dynamicMissingCount = words.filter(isMissingBySelectedOptions).length;

  useEffect(() => {
    if (isOpen) {
      setIsRunning(false);
      setProgress({ current: 0, total: 0, activeWord: '', percent: 0 });
      setResultSummary(null);
      setErrorMsg('');
      isCancelledRef.current = false;
      enrichedCountRef.current = 0;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getTargetWords = () => {
    if (scope === 'missing') {
      return words.filter(isMissingBySelectedOptions);
    }
    if (scope === 'filtered') {
      return filteredWords;
    }
    return words;
  };

  const handleStart = async () => {
    const targets = getTargetWords();
    if (!targets || targets.length === 0) {
      setErrorMsg('Không có từ vựng nào phù hợp với phạm vi đã chọn.');
      return;
    }

    if (!fillCollocations && !fillExample && !fillViMeaning && !fillPhoneticAndMeaning) {
      setErrorMsg('Vui lòng chọn ít nhất 1 loại dữ liệu cần bổ sung.');
      return;
    }

    setErrorMsg('');
    setIsRunning(true);
    isCancelledRef.current = false;
    enrichedCountRef.current = 0;
    setResultSummary(null);

    const options = {
      fillCollocations,
      fillExample,
      fillViMeaning,
      fillMeaning: fillPhoneticAndMeaning,
      fillPhonetic: fillPhoneticAndMeaning,
      forceOverwrite,
      concurrency: 6
    };

    try {
      const enrichedResults = await enrichWordsBatch(
        targets,
        options,
        (prog) => setProgress(prog),
        isCancelledRef,
        (singleEnriched) => {
          // Real-time incremental save: saves each word the moment it is enriched
          enrichedCountRef.current += 1;
          if (onBatchUpdate) {
            onBatchUpdate([singleEnriched]);
          }
        }
      );

      if (enrichedResults && enrichedResults.length > 0) {
        // Final consistency sync
        onBatchUpdate(enrichedResults);
        setResultSummary({
          total: targets.length,
          completed: enrichedCountRef.current || (isCancelledRef.current ? progress.current : targets.length),
          isCancelled: isCancelledRef.current
        });
      }
    } catch (err) {
      console.error('Batch enrich error:', err);
      setErrorMsg('Có lỗi xảy ra trong quá trình xử lý: ' + (err.message || 'Lỗi mạng'));
    } finally {
      setIsRunning(false);
    }
  };

  const handleStop = () => {
    isCancelledRef.current = true;
    setIsRunning(false);
    setResultSummary({
      total: progress.total || getTargetWords().length,
      completed: enrichedCountRef.current || progress.current,
      isCancelled: true
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 1100,
        display: 'grid',
        placeItems: 'center',
        padding: '1rem',
      }}
      onClick={isRunning ? undefined : onClose}
    >
      <div
        className="modal-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem',
          overflowY: 'auto',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header */}
        <div className="flex-between" style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ padding: '0.4rem', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-secondary)' }}>
              <Sparkles size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>Tự động điền dữ liệu từ vựng</h3>
              <p className="text-muted" style={{ margin: 0, fontSize: '0.75rem' }}>
                3 Collocations tiếng Anh chuẩn ngữ liệu, 1 câu ví dụ và nghĩa tiếng Việt
              </p>
            </div>
          </div>
          {!isRunning && (
            <button
              onClick={onClose}
              className="btn btn-outline"
              style={{ padding: '0.3rem', borderRadius: '50%' }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {errorMsg && (
            <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--accent-danger)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {resultSummary && (
            <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: 'var(--accent-success, #10b981)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Check size={16} />
              <span>
                {resultSummary.isCancelled
                  ? `Đã dừng. Đã cập nhật thành công ${resultSummary.completed}/${resultSummary.total} từ.`
                  : `Hoàn tất! Đã làm giàu dữ liệu thành công cho toàn bộ ${resultSummary.completed} từ.`}
              </span>
            </div>
          )}

          {/* Running progress view */}
          {isRunning ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0' }}>
              <div className="flex-between" style={{ fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Loader2 size={16} className="spin text-gradient" />
                  Đang xử lý: <span style={{ color: 'var(--accent-secondary)' }}>{progress.activeWord}</span>
                </span>
                <span className="text-muted" style={{ fontWeight: 600 }}>
                  {progress.current} / {progress.total} ({progress.percent}%)
                </span>
              </div>

              <div style={{ width: '100%', height: '10px', background: 'rgba(0,0,0,0.1)', borderRadius: '999px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${progress.percent}%`,
                    height: '100%',
                    background: 'var(--gradient-primary, linear-gradient(90deg, #3b82f6, #10b981))',
                    transition: 'width 0.2s ease',
                    borderRadius: '999px',
                  }}
                />
              </div>

              <p className="text-muted" style={{ fontSize: '0.75rem', textAlign: 'center', margin: 0 }}>
                Hệ thống đang truy vấn Datamuse API (Collocations), Tatoeba Corpus (Ví dụ) và Google Translate song song...
              </p>
            </div>
          ) : (
            <>
              {/* Scope Selection */}
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem', display: 'block' }}>
                  1. Phạm vi áp dụng:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      padding: '0.6rem 0.8rem',
                      borderRadius: '8px',
                      background: scope === 'missing' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(0,0,0,0.03)',
                      border: scope === 'missing' ? '1px solid var(--accent-secondary)' : '1px solid var(--glass-border)',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                    }}
                  >
                    <input
                      type="radio"
                      name="enrichScope"
                      checked={scope === 'missing'}
                      onChange={() => setScope('missing')}
                    />
                    <div>
                      <strong>Chỉ các từ còn thiếu thông tin</strong>
                      <span className="text-muted" style={{ fontSize: '0.75rem', display: 'block' }}>
                        {(!fillCollocations && !fillExample && !fillViMeaning && !fillPhoneticAndMeaning)
                          ? '(Vui lòng chọn ít nhất 1 loại dữ liệu ở mục 2)'
                          : `(Có ${dynamicMissingCount} từ đang thiếu theo các mục bạn chọn bên dưới)`}
                      </span>
                    </div>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      padding: '0.6rem 0.8rem',
                      borderRadius: '8px',
                      background: scope === 'filtered' ? 'rgba(59, 130, 246, 0.15)' : 'var(--glass-bg, rgba(255,255,255,0.04))',
                      border: scope === 'filtered' ? '1px solid var(--accent-secondary)' : '1px solid var(--glass-border)',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                    }}
                  >
                    <input
                      type="radio"
                      name="enrichScope"
                      checked={scope === 'filtered'}
                      onChange={() => setScope('filtered')}
                    />
                    <div>
                      <strong>Các từ trong bộ lọc hiện tại</strong>
                      <span className="text-muted" style={{ fontSize: '0.75rem', display: 'block' }}>
                        ({filteredWords.length} từ đang hiển thị trên danh sách)
                      </span>
                    </div>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      padding: '0.6rem 0.8rem',
                      borderRadius: '8px',
                      background: scope === 'all' ? 'rgba(59, 130, 246, 0.15)' : 'var(--glass-bg, rgba(255,255,255,0.04))',
                      border: scope === 'all' ? '1px solid var(--accent-secondary)' : '1px solid var(--glass-border)',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                    }}
                  >
                    <input
                      type="radio"
                      name="enrichScope"
                      checked={scope === 'all'}
                      onChange={() => setScope('all')}
                    />
                    <div>
                      <strong>Toàn bộ từ vựng trong thư viện</strong>
                      <span className="text-muted" style={{ fontSize: '0.75rem', display: 'block' }}>
                        ({words.length} từ)
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Data fields to enrich */}
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem', display: 'block' }}>
                  2. Chọn dữ liệu cần bổ sung:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                      padding: '0.5rem 0.7rem',
                      borderRadius: '8px',
                      background: fillCollocations ? 'rgba(59, 130, 246, 0.08)' : 'var(--glass-bg, rgba(255,255,255,0.04))',
                      border: fillCollocations ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid var(--glass-border)',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="checkbox"
                        checked={fillCollocations}
                        onChange={(e) => setFillCollocations(e.target.checked)}
                      />
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Layers size={13} color="var(--accent-secondary)" /> 3 Collocations (EN)
                      </span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: missingCollocationsCount > 0 ? 'var(--accent-warning, #f59e0b)' : 'var(--text-muted)', fontWeight: 500 }}>
                      {missingCollocationsCount > 0 ? `(Thiếu ${missingCollocationsCount})` : '✓ Đủ'}
                    </span>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                      padding: '0.5rem 0.7rem',
                      borderRadius: '8px',
                      background: fillExample ? 'rgba(59, 130, 246, 0.08)' : 'var(--glass-bg, rgba(255,255,255,0.04))',
                      border: fillExample ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid var(--glass-border)',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="checkbox"
                        checked={fillExample}
                        onChange={(e) => setFillExample(e.target.checked)}
                      />
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <BookOpen size={13} color="var(--accent-secondary)" /> 1 Câu ví dụ
                      </span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: missingExampleCount > 0 ? 'var(--accent-warning, #f59e0b)' : 'var(--text-muted)', fontWeight: 500 }}>
                      {missingExampleCount > 0 ? `(Thiếu ${missingExampleCount})` : '✓ Đủ'}
                    </span>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                      padding: '0.5rem 0.7rem',
                      borderRadius: '8px',
                      background: fillViMeaning ? 'rgba(59, 130, 246, 0.08)' : 'var(--glass-bg, rgba(255,255,255,0.04))',
                      border: fillViMeaning ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid var(--glass-border)',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="checkbox"
                        checked={fillViMeaning}
                        onChange={(e) => setFillViMeaning(e.target.checked)}
                      />
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Globe size={13} color="var(--accent-secondary)" /> Nghĩa tiếng Việt
                      </span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: missingViMeaningCount > 0 ? 'var(--accent-warning, #f59e0b)' : 'var(--text-muted)', fontWeight: 500 }}>
                      {missingViMeaningCount > 0 ? `(Thiếu ${missingViMeaningCount})` : '✓ Đủ'}
                    </span>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                      padding: '0.5rem 0.7rem',
                      borderRadius: '8px',
                      background: fillPhoneticAndMeaning ? 'rgba(59, 130, 246, 0.08)' : 'var(--glass-bg, rgba(255,255,255,0.04))',
                      border: fillPhoneticAndMeaning ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid var(--glass-border)',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="checkbox"
                        checked={fillPhoneticAndMeaning}
                        onChange={(e) => setFillPhoneticAndMeaning(e.target.checked)}
                      />
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Volume2 size={13} color="var(--accent-secondary)" /> Phiên âm & Nghĩa EN
                      </span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: missingPhoneticAndMeaningCount > 0 ? 'var(--accent-warning, #f59e0b)' : 'var(--text-muted)', fontWeight: 500 }}>
                      {missingPhoneticAndMeaningCount > 0 ? `(Thiếu ${missingPhoneticAndMeaningCount})` : '✓ Đủ'}
                    </span>
                  </label>
                </div>
              </div>

              {/* Overwrite option */}
              <div style={{ paddingTop: '0.3rem' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={forceOverwrite}
                    onChange={(e) => setForceOverwrite(e.target.checked)}
                  />
                  <span>Ghi đè cả những từ đã có dữ liệu (Mặc định: Chỉ điền ô còn trống)</span>
                </label>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid var(--glass-border)' }}>
          {isRunning ? (
            <button onClick={handleStop} className="btn btn-outline" style={{ borderColor: 'var(--accent-danger)', color: 'var(--accent-danger)' }}>
              <Square size={14} /> Dừng lại
            </button>
          ) : (
            <>
              <button onClick={onClose} className="btn btn-outline">
                Đóng
              </button>
              <button onClick={handleStart} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Play size={14} /> Bắt đầu điền dữ liệu
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnrichModal;
