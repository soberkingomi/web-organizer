'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Folder, FileText, ChevronRight, LogOut, Tv, Film, Trash2, 
  RefreshCw, X, Terminal, Square, Check, Cloud, Settings, Sun, Moon,
  ArrowUp, ArrowDown
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

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
  
  // 排序状态
  const [sortBy, setSortBy] = useState<'name' | 'updated_at'>('name');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  
  // 长按选择支持
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  
  const [processing, setProcessing] = useState(false);
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const { theme, setTheme } = useTheme();

  const currentFolder = currentPath[currentPath.length - 1];

  // 从 localStorage 恢复排序设置
  useEffect(() => {
    const savedSortBy = localStorage.getItem('file_sort_by') as 'name' | 'updated_at' | null;
    const savedSortOrder = localStorage.getItem('file_sort_order') as 'ASC' | 'DESC' | null;
    
    if (savedSortBy) setSortBy(savedSortBy);
    if (savedSortOrder) setSortOrder(savedSortOrder);
  }, []);

  const fetchFiles = async (fileId: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/cmcc/files', {
        method: 'POST',
        body: JSON.stringify({ 
          ...config, 
          fileId,
          orderBy: sortBy,
          orderDirection: sortOrder
        })
      });
      const data = await res.json();
      if (data.items) {
        setFiles(data.items); // 直接使用 API 返回的排序结果
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
  }, [currentFolder, sortBy, sortOrder]); // 添加排序依赖

  const handleNavigate = (folder: FileItem) => {
    if (!folder.is_dir) return;
    setCurrentPath([...currentPath, { id: folder.file_id, name: folder.name }]);
  };

  const jumpTo = (index: number) => {
    setCurrentPath(currentPath.slice(0, index + 1));
  };

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedItems(newSet);
  };

  // 长按处理
  const handleLongPressStart = (fileId: string) => {
    const timer = setTimeout(() => {
      setSelectMode(true);
      const newSet = new Set(selectedItems);
      newSet.add(fileId);
      setSelectedItems(newSet);
    }, 500); // 500ms 触发
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
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

  const handleSortChange = (newSortBy: 'name' | 'updated_at') => {
    setSortBy(newSortBy);
    localStorage.setItem('file_sort_by', newSortBy);
  };

  const toggleSortOrder = () => {
    const newOrder = sortOrder === 'ASC' ? 'DESC' : 'ASC';
    setSortOrder(newOrder);
    localStorage.setItem('file_sort_order', newOrder);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-base)' }}>
      {/* Header - Logo & Settings */}
      <header style={{ 
        padding: '0.75rem 1.25rem', 
        background: 'var(--bg-surface)', 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem'
      }}>
        {/* 左侧: Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Cloud size={28} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-primary)' }}>云盘助手</span>
        </div>

        {/* 右侧: 试运行 + 设置 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* 试运行开关 */}
          <div 
            onClick={() => setDryRun(!dryRun)}
            title={dryRun ? "当前为试运行模式，不会修改文件" : "注意：当前为执行模式，将直接修改文件"}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.6rem', 
              cursor: 'pointer',
              padding: '0.4rem 0.6rem',
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ 
              fontSize: '0.9rem', 
              color: dryRun ? 'var(--text-primary)' : 'var(--text-muted)', 
              fontWeight: 500,
              transition: 'color 0.2s'
            }}>
              试运行
            </span>
            <div style={{
              width: '36px',
              height: '20px',
              borderRadius: '12px',
              background: dryRun ? 'var(--accent)' : 'var(--bg-elevated)',
              border: `1px solid ${dryRun ? 'var(--accent)' : 'var(--border)'}`,
              position: 'relative',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: dryRun ? '0 2px 4px rgba(0,0,0,0.1)' : 'inset 0 1px 2px rgba(0,0,0,0.05)'
            }}>
              <div style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: '#fff',
                position: 'absolute',
                top: '1px',
                left: dryRun ? '17px' : '1px',
                transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
              }} />
            </div>
          </div>
          
          <button onClick={() => setShowLogs(!showLogs)} className="btn-icon-sm" title="日志">
            <Terminal size={18} />
          </button>
          
          {/* 设置按钮 */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowSettings(!showSettings)} className="btn-icon-sm" title="设置">
              <Settings size={18} />
            </button>
            
            {/* 设置下拉菜单 */}
            {showSettings && (
              <>
                <div 
                  style={{ position: 'fixed', inset: 0, zIndex: 99 }} 
                  onClick={() => setShowSettings(false)} 
                />
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.5rem',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  boxShadow: 'var(--shadow-lg)',
                  minWidth: '130px',
                  zIndex: 100,
                  overflow: 'hidden',
                  padding: '0.25rem'
                }}>
                  {/* 主题切换 */}
                  <button
                    onClick={() => {
                      if (theme === 'dark') setTheme('light');
                      else if (theme === 'light') setTheme('system');
                      else setTheme('dark');
                    }}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.6rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                    {theme === 'dark' ? '暗色模式' : theme === 'light' ? '亮色模式' : '跟随系统'}
                  </button>
                  
                  <div style={{ height: '1px', background: 'var(--border)', margin: '0.2rem 0.5rem' }} />
                  
                  {/* 登出 */}
                  <button
                    onClick={() => { setShowSettings(false); onLogout(); }}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.6rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      color: 'var(--error)',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <LogOut size={18} />
                    退出登录
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 工具栏 - 功能按钮 + 选择按钮 */}
      <div style={{ 
        padding: '0.6rem 1.25rem', 
        display: 'flex', 
        alignItems: 'center',
        gap: '0.5rem',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)'
      }}>
        {/* 功能按钮 */}
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button onClick={() => runAction('series')} disabled={processing} className="btn-action" title="剧集整理">
            <Tv size={18} />
          </button>
          <button onClick={() => runAction('movie')} disabled={processing} className="btn-action" title="电影整理">
            <Film size={18} />
          </button>
          <button onClick={() => runAction('clean')} disabled={processing} className="btn-action" title="清理垃圾">
            <Trash2 size={18} />
          </button>
        </div>
        
        {/* 分隔线 */}
        <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />
        
        {processing && (
          <button onClick={stopProcessing} className="btn-text" style={{ color: 'var(--error)', fontSize: '0.9rem' }}>
            <Square size={14} /> 停止
          </button>
        )}
        
        <div style={{ flex: 1 }} />
        
        {/* 选择按钮 - 移到右侧 */}
        {!selectMode && selectedItems.size === 0 && (
          <button 
            onClick={() => setSelectMode(true)} 
            className="btn-icon-sm" 
            title="选择"
          >
            <Check size={16} />
          </button>
        )}
        
        {/* 排序控制 */}
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value as any)}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              cursor: 'pointer',
              fontWeight: 500,
              transition: 'all 0.2s ease',
              outline: 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover)';
              e.currentTarget.style.borderColor = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-elevated)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
          >
            <option value="name">名称</option>
            <option value="updated_at">修改时间</option>
          </select>
          
          <button
            onClick={toggleSortOrder}
            className="btn-icon-sm"
            title={sortOrder === 'ASC' ? '升序' : '降序'}
          >
            {sortOrder === 'ASC' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
          </button>
        </div>
        
        {/* 刷新 */}
        <button 
          onClick={() => fetchFiles(currentFolder.id)} 
          disabled={loading} 
          className="btn-icon-sm"
          title="刷新"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 选择模式提示条 */}
      {(selectMode || selectedItems.size > 0) && (
        <div style={{
          background: 'var(--accent)',
          color: 'white',
          padding: '0.5rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.85rem',
          fontWeight: 500
        }}>
          <span>已选择 {selectedItems.size} 项</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              onClick={() => {
                if (selectedItems.size === files.length) {
                  setSelectedItems(new Set());
                } else {
                  setSelectedItems(new Set(files.map(f => f.file_id)));
                }
              }}
              style={{
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: 'none',
                padding: '0.3rem 0.6rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              {selectedItems.size === files.length ? '取消全选' : '全选'}
            </button>
            <button 
              onClick={() => {
                setSelectMode(false);
                setSelectedItems(new Set());
              }}
              style={{
                background: 'transparent',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.4)',
                padding: '0.3rem 0.6rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <div style={{ 
        padding: '0.6rem 1.25rem',
        background: 'var(--bg-base)'
      }}>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.9rem' }}>
          <button
            onClick={() => jumpTo(0)}
            style={{
              background: 'none',
              border: 'none',
              color: currentPath.length === 1 ? 'var(--text-primary)' : '#3b82f6',
              fontWeight: currentPath.length === 1 ? 600 : 500,
              cursor: 'pointer',
              padding: '0.25rem 0',
              marginLeft: '0.25rem'
            }}
          >
            全部
          </button>
          {currentPath.slice(1).map((p, i) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center' }}>
              <ChevronRight size={16} style={{ color: 'var(--text-muted)', margin: '0 0.2rem' }} />
              <button
                onClick={() => jumpTo(i + 1)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: i + 1 === currentPath.length - 1 ? 'var(--text-primary)' : '#3b82f6',
                  fontWeight: i + 1 === currentPath.length - 1 ? 600 : 500,
                  cursor: i + 1 === currentPath.length - 1 ? 'default' : 'pointer',
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
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%',
            gap: '1rem'
          }}>
            <div className="loader" />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>加载中...</span>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {files.map(f => {
              const isSelected = selectedItems.has(f.file_id);
              return (
                <div
                  key={f.file_id}
                  onClick={() => {
                    if (selectMode || selectedItems.size > 0) {
                      // 选择模式：点击选中/取消
                      toggleSelect(f.file_id);
                    } else {
                      // 普通模式：点击导航
                      if (f.is_dir) handleNavigate(f);
                    }
                  }}
                  onTouchStart={() => !(selectMode || selectedItems.size > 0) && handleLongPressStart(f.file_id)}
                  onTouchEnd={handleLongPressEnd}
                  onTouchMove={handleLongPressEnd}
                  onMouseDown={() => !(selectMode || selectedItems.size > 0) && handleLongPressStart(f.file_id)}
                  onMouseUp={handleLongPressEnd}
                  style={{
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--accent-muted)' : 'var(--bg-surface)',
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'transparent'}`,
                    borderRadius: 'var(--radius-sm)',
                    transition: 'all 0.12s ease',
                    boxShadow: isSelected ? 'none' : 'var(--shadow-sm)'
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'var(--bg-elevated)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={e => {
                    handleLongPressEnd(); // 取消长按
                    if (!isSelected) {
                      e.currentTarget.style.background = 'var(--bg-surface)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                      e.currentTarget.style.transform = 'translateY(0)';
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
                      fontSize: '0.9rem',
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
        
        /* 移动端响应式样式 */
        @media (max-width: 640px) {
          /* 移动端隐藏选择按钮文案 */
          .select-text {
            display: none;
          }
          /* 移动端显示图标 */
          .select-icon {
            display: inline-block;
          }
        }
        
        /* 桌面端显示文案，隐藏图标 */
        @media (min-width: 641px) {
          .select-text {
            display: inline;
          }
          .select-icon {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
