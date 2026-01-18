'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Folder, FileText, ChevronRight, LogOut, Tv, Film, Trash2, 
  RefreshCw, X, Terminal, Square, MoreHorizontal, Check, Cloud
} from 'lucide-react';
import { ThemeSwitcher } from './ThemeSwitcher';

interface Props {
  config: any;
  onLogout: () => void;
}

interface FileItem {
  file_id: string;
  name: string;
  is_dir: boolean;
  size: number;
  updated_at: string;
}

interface ActionLog {
  type: string;
  description: string;
}

export function FileBrowser({ config, onLogout }: Props) {
  const [currentPath, setCurrentPath] = useState<{id: string, name: string}[]>([{id: 'root', name: '根目录'}]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  
  const [processing, setProcessing] = useState(false);
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const currentFolder = currentPath[currentPath.length - 1];

  const fetchFiles = async (fileId: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/cmcc/files', {
        method: 'POST',
        body: JSON.stringify({ ...config, fileId })
      });
      const data = await res.json();
      if (data.items) {
        const sorted = data.items.sort((a: FileItem, b: FileItem) => {
          if (a.is_dir === b.is_dir) return a.name.localeCompare(b.name);
          return a.is_dir ? -1 : 1;
        });
        setFiles(sorted);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles(currentFolder.id);
    setSelectedItems(new Set());
    setSelectMode(false);
  }, [currentFolder]);

  const handleNavigate = (folder: FileItem) => {
    if (!folder.is_dir) return;
    setCurrentPath([...currentPath, { id: folder.file_id, name: folder.name }]);
  };

  const jumpTo = (index: number) => {
    setCurrentPath(currentPath.slice(0, index + 1));
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedItems(newSet);
  };

  const stopProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setProcessing(false);
    setLogs(prev => [...prev, { type: 'info', description: '⏹ 操作已停止' }]);
  };

  const runAction = async (type: 'series' | 'movie' | 'clean') => {
    setProcessing(true);
    setShowLogs(true);
    setLogs([]);
    abortControllerRef.current = new AbortController();

    const endpoint = type === 'clean' ? '/api/clean' : `/api/organize/${type}`;
    
    const itemsToProcess = selectedItems.size > 0 
      ? files.filter(f => selectedItems.has(f.file_id)) 
      : [{ file_id: currentFolder.id, name: currentFolder.name, is_dir: true } as FileItem];

    for (const item of itemsToProcess) {
      if (abortControllerRef.current?.signal.aborted) break;
      if (!item.is_dir && type !== 'clean') continue;
      
      setLogs(prev => [...prev, { type: 'info', description: `▶ 处理中: ${item.name}` }]);
      
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          body: JSON.stringify({
            ...config,
            folderId: item.file_id,
            folderName: item.name,
            dryRun
          }),
          signal: abortControllerRef.current.signal
        });
        const data = await res.json();
        if (data.logs) {
          const newLogs = data.logs.map((l: any) => 
            typeof l === 'string' ? { type: 'info', description: l } : l
          );
          setLogs(prev => [...prev, ...newLogs]);
        }
        if (data.error) {
          setLogs(prev => [...prev, { type: 'error', description: `✗ ${data.error}` }]);
        }
      } catch (e: any) {
        if (e.name === 'AbortError') break;
        setLogs(prev => [...prev, { type: 'error', description: `✗ 网络错误: ${e.message}` }]);
      }
    }
    
    setProcessing(false);
    abortControllerRef.current = null;
    if (!dryRun) fetchFiles(currentFolder.id);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-base)' }}>
      {/* Header - Logo & Tools */}
      <header style={{ 
        padding: '0.75rem 1.5rem', 
        background: 'var(--bg-surface)', 
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem'
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Cloud size={24} style={{ color: 'var(--text-primary)' }} />
          <span style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--text-primary)' }}>云盘助手</span>
        </div>

        {/* Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* 试运行开关 */}
          <div 
            onClick={() => setDryRun(!dryRun)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              cursor: 'pointer',
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              background: dryRun ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-hover)',
              border: `1px solid ${dryRun ? 'rgba(34, 197, 94, 0.3)' : 'var(--border)'}`,
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{
              width: '32px',
              height: '18px',
              borderRadius: '9px',
              background: dryRun ? '#22c55e' : 'var(--text-muted)',
              position: 'relative',
              transition: 'background 0.2s ease'
            }}>
              <div style={{
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: 'white',
                position: 'absolute',
                top: '2px',
                left: dryRun ? '16px' : '2px',
                transition: 'left 0.2s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
              }} />
            </div>
            <span style={{ fontSize: '0.85rem', color: dryRun ? '#22c55e' : 'var(--text-secondary)', fontWeight: 500 }}>
              试运行
            </span>
          </div>
          <ThemeSwitcher />
          <button onClick={() => setShowLogs(!showLogs)} className="btn btn-ghost btn-icon" title="日志">
            <Terminal size={18} />
          </button>
          <button onClick={onLogout} className="btn btn-ghost btn-icon" title="登出">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div style={{ 
        padding: '0.75rem 1.5rem', 
        display: 'flex', 
        gap: '0.75rem', 
        flexWrap: 'wrap',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)'
      }}>
        <button onClick={() => runAction('series')} disabled={processing} className="btn btn-secondary">
          <Tv size={16} /> <span className="mobile-hide">剧集</span>
        </button>
        <button onClick={() => runAction('movie')} disabled={processing} className="btn btn-secondary">
          <Film size={16} /> <span className="mobile-hide">电影</span>
        </button>
        <button onClick={() => runAction('clean')} disabled={processing} className="btn btn-secondary">
          <Trash2 size={16} /> <span className="mobile-hide">清理</span>
        </button>
        
        {/* 多选按钮 */}
        {!selectMode && selectedItems.size === 0 ? (
          <button 
            onClick={() => setSelectMode(true)}
            className="btn btn-secondary"
            title="多选"
          >
            <Check size={16} /> <span className="mobile-hide">多选</span>
          </button>
        ) : (
          <button 
            onClick={() => { setSelectMode(false); setSelectedItems(new Set()); }}
            className="btn btn-secondary"
            style={{ color: 'var(--accent)' }}
          >
            取消 {selectedItems.size > 0 && `(${selectedItems.size})`}
          </button>
        )}
        
        {processing && (
          <button onClick={stopProcessing} className="btn" style={{ background: 'var(--error)', color: 'white' }}>
            <Square size={16} /> 停止
          </button>
        )}
        
        <div style={{ flex: 1 }} />
        
        <button 
          onClick={() => fetchFiles(currentFolder.id)} 
          disabled={loading} 
          className="btn btn-ghost btn-icon"
          title="刷新"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Breadcrumb - 面包屑导航 */}
      <div style={{ 
        padding: '0.75rem 1.5rem',
        background: 'var(--bg-base)',
        borderBottom: '1px solid var(--border)'
      }}>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '1rem' }}>
          <button
            onClick={() => jumpTo(0)}
            style={{
              background: 'none',
              border: 'none',
              color: currentPath.length === 1 ? 'var(--text-primary)' : 'var(--accent)',
              fontWeight: currentPath.length === 1 ? 600 : 500,
              cursor: 'pointer',
              padding: '0.25rem 0',
              marginLeft: '0.5rem'
            }}
          >
            全部
          </button>
          {currentPath.slice(1).map((p, i) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center' }}>
              <ChevronRight size={14} style={{ color: 'var(--text-muted)', margin: '0 0.25rem' }} />
              <button
                onClick={() => jumpTo(i + 1)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: i + 1 === currentPath.length - 1 ? 'var(--text-primary)' : 'var(--accent)',
                  fontWeight: i + 1 === currentPath.length - 1 ? 600 : 500,
                  cursor: 'pointer',
                  padding: '0.25rem 0'
                }}
              >
                {p.name}
              </button>
            </div>
          ))}
        </nav>
      </div>

      {/* File List */}
      <div style={{ flex: 1, overflow: 'auto', padding: '1rem 1.5rem' }}>
        {loading ? (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '200px',
            color: 'var(--text-muted)'
          }}>
            <RefreshCw size={24} className="animate-spin" style={{ marginRight: '0.5rem' }} />
            加载中...
          </div>
        ) : files.length === 0 ? (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '200px',
            color: 'var(--text-muted)'
          }}>
            <Folder size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
            <p>此文件夹为空</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {files.map(f => {
              const isSelected = selectedItems.has(f.file_id);
              return (
                <div
                  key={f.file_id}
                  onClick={() => f.is_dir ? handleNavigate(f) : null}
                  style={{
                    padding: '0.875rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.875rem',
                    cursor: f.is_dir ? 'pointer' : 'default',
                    background: isSelected ? 'var(--accent-muted)' : 'var(--bg-surface)',
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'var(--bg-elevated)';
                      e.currentTarget.style.borderColor = 'var(--border-hover)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'var(--bg-surface)';
                      e.currentTarget.style.borderColor = 'var(--border)';
                    }
                  }}
                >
                  {/* Checkbox - 只在多选模式下显示 */}
                  {(selectMode || selectedItems.size > 0) && (
                    <button
                      onClick={(e) => toggleSelect(f.file_id, e)}
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '5px',
                        border: isSelected ? 'none' : '2px solid var(--border-hover)',
                        background: isSelected ? 'var(--accent)' : 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {isSelected && <Check size={12} color="white" strokeWidth={3} />}
                    </button>
                  )}

                  {/* Icon with background */}
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: 'var(--radius-md)',
                    background: f.is_dir ? 'rgba(249, 200, 14, 0.15)' : 'var(--bg-hover)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {f.is_dir ? (
                      <Folder size={22} style={{ color: 'var(--folder-color)' }} />
                    ) : (
                      <FileText size={20} style={{ color: 'var(--file-color)' }} />
                    )}
                  </div>

                  {/* Name & Meta */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ 
                      fontWeight: f.is_dir ? 500 : 400,
                      fontSize: '1rem',
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      lineHeight: '1.3',
                      width: '100%'
                    }}>
                      {f.name}
                    </div>
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: 'var(--text-muted)',
                      display: 'flex',
                      gap: '0.75rem',
                      marginTop: '0.15rem',
                      width: '100%'
                    }}>
                      {!f.is_dir && <span>{formatSize(f.size)}</span>}
                    </div>
                  </div>

                  {f.is_dir && (
                    <ChevronRight size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Logs Panel */}
      {showLogs && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '35vh',
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 100,
          boxShadow: '0 -4px 24px rgba(0,0,0,0.2)'
        }}>
          <div style={{
            padding: '0.75rem 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-elevated)'
          }}>
            <span style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Terminal size={16} />
              活动日志
              {processing && <span style={{ color: 'var(--accent)' }}>• 运行中</span>}
            </span>
            <button onClick={() => setShowLogs(false)} className="btn btn-ghost btn-icon">
              <X size={18} />
            </button>
          </div>
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '1rem 1.5rem',
            fontFamily: 'ui-monospace, "SF Mono", Monaco, monospace',
            fontSize: '0.8rem',
            lineHeight: '1.8'
          }}>
            {logs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>
                暂无日志
              </div>
            ) : (
              logs.map((l, i) => (
                <div key={i} style={{
                  color: l.type === 'error' ? 'var(--error)' : 
                         l.type === 'rename' ? 'var(--success)' : 
                         l.type === 'warning' ? 'var(--warning)' : 'var(--text-secondary)'
                }}>
                  {l.description}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
