import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../services/apiClient';
import { ShieldCheck, Lock, Mail, Eye, EyeOff, Loader2, AlertCircle, Info } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, isAuthenticated, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check if redirected due to expired session
  const searchParams = new URLSearchParams(location.search);
  const isSessionExpired = searchParams.get('expired') === '1';

  // If already authenticated, redirect
  useEffect(() => {
    if (isAuthenticated && role) {
      const destination = role === 'PARTNER' ? '/customers' : '/';
      navigate(destination, { replace: true });
    }
  }, [isAuthenticated, role, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const user = await login(email.trim(), password);
      // Determine destination
      const fromPath = (location.state as { from?: { pathname: string } })?.from?.pathname;
      if (user.role === 'PARTNER') {
        // If fromPath is an admin-only path, redirect to /customers
        if (fromPath && (fromPath.startsWith('/customers') || fromPath.startsWith('/follow-ups'))) {
          navigate(fromPath, { replace: true });
        } else {
          navigate('/customers', { replace: true });
        }
      } else {
        navigate(fromPath || '/', { replace: true });
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 401) {
          setErrorMessage('Email hoặc mật khẩu không chính xác.');
        } else if (err.statusCode === 403) {
          setErrorMessage('Tài khoản đã bị tạm khóa. Vui lòng liên hệ Quản trị viên để được hỗ trợ.');
        } else if (err.statusCode === 429) {
          setErrorMessage('Quá nhiều lần đăng nhập không thành công. Vui lòng thử lại sau 15 phút.');
        } else {
          setErrorMessage(err.message || 'Đăng nhập không thành công. Vui lòng thử lại.');
        }
      } else {
        setErrorMessage('Không thể kết nối đến máy chủ. Vui lòng kiểm tra đường truyền.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-xl shadow-blue-500/20 mb-4 border border-blue-400/20">
            <span className="text-xl font-black text-white font-mono tracking-wider">KT</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 font-sans">
            KTEA CRM SYSTEM
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono uppercase tracking-wider">
            Cổng Đăng Nhập Nhân Viên & Quản Trị
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-xl p-8 space-y-6">
          {isSessionExpired && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs leading-relaxed animate-fade-in">
              <Info className="w-4 h-4 flex-shrink-0 text-amber-400 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-200">Phiên làm việc đã hết hạn</p>
                <p className="text-amber-300/80 mt-0.5">Vui lòng đăng nhập lại để tiếp tục thao tác.</p>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs leading-relaxed animate-fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-200">Lỗi đăng nhập</p>
                <p className="text-rose-300/90 mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider font-mono">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@ktea.vn"
                  required
                  autoFocus
                  autoComplete="email"
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/60 transition-all font-sans"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider font-mono">
                Mật khẩu
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  autoComplete="current-password"
                  disabled={isLoading}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/60 transition-all font-sans"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] text-white font-medium rounded-xl text-sm shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:pointer-events-none font-sans"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang xác thực...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Đăng nhập hệ thống</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-800/80 text-center">
            <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
              Tài khoản được cấp phát và quản lý bởi Quản trị viên KTEA.
              <br />
              Hệ thống ghi nhận địa chỉ IP và nhật ký phiên truy cập.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
