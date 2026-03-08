'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { login, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    if (user) router.replace('/dashboard');
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(username, password);

    if (result.success) {
      router.replace('/dashboard');
    } else {
      setError(result.error || 'Login gagal');
    }

    setIsLoading(false);
  };

  if (!mounted) return null;

  return (
    <div className="login-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .login-root {
          min-height: 100vh;
          display: flex;
          background: #0a0a0f;
          font-family: 'DM Sans', sans-serif;
          overflow: hidden;
          position: relative;
        }

        /* Animated background blobs */
        .bg-blob {
          position: fixed;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.15;
          animation: blobFloat 8s ease-in-out infinite;
          pointer-events: none;
        }
        .bg-blob-1 {
          width: 600px; height: 600px;
          background: radial-gradient(circle, #6366f1, transparent);
          top: -200px; left: -150px;
          animation-delay: 0s;
        }
        .bg-blob-2 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, #8b5cf6, transparent);
          bottom: -150px; right: -100px;
          animation-delay: 3s;
        }
        .bg-blob-3 {
          width: 300px; height: 300px;
          background: radial-gradient(circle, #06b6d4, transparent);
          top: 40%; left: 60%;
          animation-delay: 1.5s;
        }

        @keyframes blobFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(20px, -30px) scale(1.05); }
          66% { transform: translate(-15px, 20px) scale(0.95); }
        }

        /* Grid texture */
        .bg-grid {
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 60px 60px;
          pointer-events: none;
        }

        /* Left panel */
        .left-panel {
          display: none;
          flex: 1;
          padding: 60px;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          z-index: 1;
        }
        @media (min-width: 1024px) { .left-panel { display: flex; } }

        .brand-logo {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .logo-mark {
          width: 40px; height: 40px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .logo-mark svg { width: 22px; height: 22px; color: white; }
        .brand-name {
          font-family: 'Syne', sans-serif;
          font-size: 20px;
          font-weight: 700;
          color: white;
          letter-spacing: -0.3px;
        }

        .hero-text {
          max-width: 420px;
        }
        .hero-label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border: 1px solid rgba(99,102,241,0.4);
          border-radius: 100px;
          color: #a5b4fc;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          margin-bottom: 24px;
          background: rgba(99,102,241,0.08);
        }
        .hero-label::before {
          content: '';
          width: 6px; height: 6px;
          background: #6366f1;
          border-radius: 50%;
          box-shadow: 0 0 8px #6366f1;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        .hero-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(36px, 4vw, 52px);
          font-weight: 800;
          color: white;
          line-height: 1.1;
          letter-spacing: -1.5px;
          margin-bottom: 20px;
        }
        .hero-title span {
          background: linear-gradient(135deg, #6366f1, #a78bfa, #06b6d4);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hero-desc {
          color: #6b7280;
          font-size: 16px;
          line-height: 1.7;
          font-weight: 300;
        }

        .stats-row {
          display: flex;
          gap: 32px;
        }
        .stat-item { }
        .stat-num {
          font-family: 'Syne', sans-serif;
          font-size: 28px;
          font-weight: 700;
          color: white;
        }
        .stat-label {
          font-size: 13px;
          color: #4b5563;
          margin-top: 2px;
        }

        /* Right panel - login form */
        .right-panel {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          position: relative;
          z-index: 1;
        }
        @media (min-width: 1024px) {
          .right-panel {
            width: 460px;
            flex-shrink: 0;
            border-left: 1px solid rgba(255,255,255,0.05);
          }
        }

        .form-card {
          width: 100%;
          max-width: 400px;
          animation: fadeUp 0.6s ease forwards;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .form-header {
          margin-bottom: 40px;
        }
        .form-title {
          font-family: 'Syne', sans-serif;
          font-size: 32px;
          font-weight: 800;
          color: white;
          letter-spacing: -1px;
          margin-bottom: 10px;
        }
        .form-subtitle {
          color: #6b7280;
          font-size: 15px;
          font-weight: 300;
        }

        /* Input groups */
        .input-group {
          margin-bottom: 20px;
        }
        .input-label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #9ca3af;
          margin-bottom: 8px;
          letter-spacing: 0.2px;
        }
        .input-wrapper {
          position: relative;
        }
        .input-icon {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: #4b5563;
          width: 18px;
          height: 18px;
          transition: color 0.2s;
        }
        .input-field {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 14px 16px 14px 48px;
          color: white;
          font-size: 15px;
          font-family: 'DM Sans', sans-serif;
          transition: all 0.2s;
          outline: none;
        }
        .input-field::placeholder { color: #374151; }
        .input-field:focus {
          border-color: rgba(99,102,241,0.5);
          background: rgba(99,102,241,0.06);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }
        .input-field:focus + .input-icon,
        .input-wrapper:focus-within .input-icon { color: #6366f1; }
        .input-field.has-toggle { padding-right: 52px; }

        .toggle-password {
          position: absolute;
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #4b5563;
          padding: 4px;
          transition: color 0.2s;
        }
        .toggle-password:hover { color: #9ca3af; }
        .toggle-password svg { width: 18px; height: 18px; }

        /* Error */
        .error-box {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 10px;
          margin-bottom: 20px;
          animation: shake 0.3s ease;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
        .error-icon { color: #ef4444; width: 16px; height: 16px; flex-shrink: 0; }
        .error-text { color: #fca5a5; font-size: 13px; }

        /* Submit button */
        .submit-btn {
          width: 100%;
          padding: 15px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: none;
          border-radius: 12px;
          color: white;
          font-size: 15px;
          font-weight: 600;
          font-family: 'Syne', sans-serif;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 8px;
          letter-spacing: 0.2px;
          position: relative;
          overflow: hidden;
        }
        .submit-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.1), transparent);
          opacity: 0;
          transition: opacity 0.2s;
        }
        .submit-btn:hover::before { opacity: 1; }
        .submit-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(99,102,241,0.35); }
        .submit-btn:active { transform: translateY(0); }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        /* Spinner */
        .spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .footer-text {
          text-align: center;
          margin-top: 28px;
          color: #374151;
          font-size: 13px;
        }
        .footer-text span { color: #6b7280; }

        /* Divider */
        .divider {
          display: flex;
          align-items: center;
          gap: 16px;
          margin: 28px 0;
        }
        .divider-line {
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.06);
        }
        .divider-text {
          color: #374151;
          font-size: 12px;
          letter-spacing: 0.5px;
        }
      `}</style>

      {/* Background */}
      <div className="bg-blob bg-blob-1" />
      <div className="bg-blob bg-blob-2" />
      <div className="bg-blob bg-blob-3" />
      <div className="bg-grid" />

      {/* Left Panel */}
      <div className="left-panel">
        <div className="brand-logo">
          <div className="logo-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
          <span className="brand-name">Studio</span>
        </div>

        <div className="hero-text">
          <div className="hero-label">Platform Manajemen</div>
          <h1 className="hero-title">
            Kelola semua<br />
            dengan <span>satu akses</span>
          </h1>
          <p className="hero-desc">
            Masuk ke dashboard untuk mengakses semua fitur, data, dan laporan yang kamu butuhkan.
          </p>
        </div>

        <div className="stats-row">
          <div className="stat-item">
            <div className="stat-num">99.9%</div>
            <div className="stat-label">Uptime</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">256-bit</div>
            <div className="stat-label">Enkripsi</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">24/7</div>
            <div className="stat-label">Support</div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="right-panel">
        <div className="form-card">
          <div className="form-header">
            <h2 className="form-title">Selamat datang</h2>
            <p className="form-subtitle">Masuk ke akun kamu untuk melanjutkan</p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Username */}
            <div className="input-group">
              <label className="input-label" htmlFor="username">Username</label>
              <div className="input-wrapper">
                <input
                  id="username"
                  type="text"
                  className="input-field"
                  placeholder="Masukkan username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
            </div>

            {/* Password */}
            <div className="input-group">
              <label className="input-label" htmlFor="password">Password</label>
              <div className="input-wrapper">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="input-field has-toggle"
                  placeholder="Masukkan password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password"
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="error-box">
                <svg className="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span className="error-text">{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="submit-btn"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner" />
                  Memverifikasi...
                </>
              ) : (
                <>
                  Masuk
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="footer-text">
            <span>Versi 1.0.0 · </span>Hubungi admin jika lupa password
          </div>
        </div>
      </div>
    </div>
  );
}