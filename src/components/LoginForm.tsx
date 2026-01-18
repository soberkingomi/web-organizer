'use client';

import { useState, useEffect } from 'react';
import { Cloud, Key, Lock, LogIn, Loader2 } from 'lucide-react';

interface LoginFormProps {
  onLogin: (config: any) => void;
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [config, setConfig] = useState({
    authorization: '',
    cookie: '',
    tmdbKey: '',
    rootId: '',
    headers: {} as Record<string, string>
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('cmcc_config');
    if (stored) {
      setConfig(JSON.parse(stored));
      return;
    }

    fetch('/api/config/read')
      .then(res => res.json())
      .then(data => {
        if (data.authorization && data.cookie) {
          setConfig({
            authorization: data.authorization,
            cookie: data.cookie,
            tmdbKey: data.tmdb_key || '',
            rootId: data.root_id || '',
            headers: data.headers || {}
          });
        }
      })
      .catch(err => console.log('Auto-load config failed', err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/cmcc/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (!res.ok) {
        throw new Error('登录失败，请检查凭证');
      }

      localStorage.setItem('cmcc_config', JSON.stringify(config));
      onLogin(config);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '2rem',
      background: 'var(--bg-base)'
    }}>
      <div className="animate-in" style={{
        width: '100%',
        maxWidth: '400px',
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        padding: '2.5rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '56px',
            height: '56px',
            background: 'var(--accent-muted)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem'
          }}>
            <Cloud size={28} style={{ color: 'var(--accent)' }} />
          </div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>139 云盘助手</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            连接到你的移动云盘
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Authorization
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="input"
                style={{ paddingLeft: '2.5rem' }}
                type="text"
                placeholder="Bearer ..."
                value={config.authorization}
                onChange={e => setConfig({...config, authorization: e.target.value})}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Cookie
            </label>
            <div style={{ position: 'relative' }}>
              <Key size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="input"
                style={{ paddingLeft: '2.5rem' }}
                type="password"
                placeholder="Cookie 字符串"
                value={config.cookie}
                onChange={e => setConfig({...config, cookie: e.target.value})}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              TMDB API Key <span style={{ opacity: 0.5 }}>(可选)</span>
            </label>
            <input
              className="input"
              type="password"
              placeholder="用于识别剧集/电影信息"
              value={config.tmdbKey}
              onChange={e => setConfig({...config, tmdbKey: e.target.value})}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              根目录 ID <span style={{ opacity: 0.5 }}>(可选)</span>
            </label>
            <input
              className="input"
              type="text"
              placeholder="默认: root"
              value={config.rootId}
              onChange={e => setConfig({...config, rootId: e.target.value})}
            />
          </div>

          {error && (
            <div style={{
              padding: '0.75rem 1rem',
              background: 'rgba(229, 49, 112, 0.1)',
              border: '1px solid var(--error)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--error)',
              fontSize: '0.9rem'
            }}>
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
            style={{ 
              width: '100%', 
              height: '44px', 
              marginTop: '0.5rem',
              fontSize: '0.95rem'
            }}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                连接中...
              </>
            ) : (
              <>
                <LogIn size={18} />
                连接
              </>
            )}
          </button>
        </form>
      </div>

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
