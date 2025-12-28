import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { UserRole } from '../types';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [shake, setShake] = useState(false);

  const { login, isAuthenticated, user, setDemoUser, isDevMode } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      const roleRedirects: Record<UserRole, string> = {
        collector: '/collector/requests',
        admin: '/admin/queue',
        supervisor: '/supervisor/dashboard',
      };
      navigate(roleRedirects[user.role], { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!username || !password) {
      showError('Please enter both username and password.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // In dev mode, simulate login with demo user
      if (isDevMode) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        setSuccessMessage(`Signing in as ${username}...`);
        setShowSuccess(true);
        setDemoUser('supervisor');

        setTimeout(() => {
          navigate('/supervisor/dashboard', { replace: true });
        }, 1500);
        return;
      }

      // Production mode: call real API
      await login({ username, password, rememberMe });
      setSuccessMessage(`Signing in as ${username}...`);
      setShowSuccess(true);
      // The useEffect at the top of this component will handle the redirect
      // once the auth state updates with the user role
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Invalid username or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const showError = (message: string) => {
    setError(message);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleDemoLogin = (role: UserRole) => {
    const demoUsers = {
      collector: { username: 'mrodriguez', name: 'Maria Rodriguez', title: 'Collector' },
      admin: { username: 'lmartinez', name: 'Lisa Martinez', title: 'Client Services' },
      supervisor: { username: 'omalik', name: 'Omar M.', title: 'General Manager' },
    };

    const demoUser = demoUsers[role];
    setSuccessMessage(`Signing in as ${demoUser.name} (${demoUser.title})...`);
    setShowSuccess(true);

    // Set user context by role
    setDemoUser(role);

    const roleRedirects: Record<UserRole, string> = {
      collector: '/collector/requests',
      admin: '/admin/queue',
      supervisor: '/supervisor/dashboard',
    };

    setTimeout(() => {
      navigate(roleRedirects[role], { replace: true });
    }, 1500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{
      background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 50%, #1e293b 100%)'
    }}>
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}></div>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md relative z-10">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-lg mb-4" style={{ boxShadow: '0 10px 40px rgba(59, 130, 246, 0.3)' }}>
            <i className="fas fa-bolt text-white text-2xl"></i>
          </div>
          <h1 className="text-2xl font-bold text-white">Billing Request OS</h1>
          <p className="text-slate-400 mt-1">Midwest Service Bureau</p>
        </div>

        {/* Login Form Card */}
        <div
          className={`bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl overflow-hidden ${shake ? 'animate-shake' : ''}`}
          style={{ animation: shake ? 'shake 0.5s ease-in-out' : undefined }}
        >
          {/* Card Header */}
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-800">Sign In</h2>
            <p className="text-slate-500 text-sm">Enter your credentials to access the system</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Error Alert */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center space-x-3 animate-fadeIn">
                <i className="fas fa-exclamation-circle text-red-500"></i>
                <span className="text-red-700 text-sm">{error}</span>
              </div>
            )}

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="fas fa-user text-slate-400"></i>
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter your username"
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="fas fa-lock text-slate-400"></i>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-12 py-3 border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-slate-600">Remember me</span>
              </label>
              <a href="#" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Forgot password?
              </a>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2 shadow-lg"
              style={{ boxShadow: '0 4px 14px rgba(59, 130, 246, 0.25)' }}
            >
              {isLoading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <i className="fas fa-arrow-right"></i>
                </>
              )}
            </button>

            {/* SSO Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">or continue with</span>
              </div>
            </div>

            {/* Google SSO Button */}
            <button
              type="button"
              className="w-full bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-3"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
              <span>Sign in with Google SSO</span>
            </button>
          </form>

          {/* Footer */}
          <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 text-center">
            <p className="text-slate-500 text-xs">
              Having trouble? Contact IT Support at{' '}
              <a href="mailto:support@msbureau.com" className="text-blue-600 hover:underline">
                support@msbureau.com
              </a>
            </p>
          </div>
        </div>

        {/* Role Switcher (Dev Mode Only) */}
        {isDevMode && (
          <div className="mt-6 bg-slate-800/50 rounded-xl p-4 backdrop-blur">
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-3 text-center">Demo: Quick Login As</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleDemoLogin('collector')}
                className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-lg text-xs font-medium transition-colors"
              >
                <i className="fas fa-headset mr-1"></i>Collector
              </button>
              <button
                onClick={() => handleDemoLogin('admin')}
                className="bg-violet-600 hover:bg-violet-700 text-white py-2 px-3 rounded-lg text-xs font-medium transition-colors"
              >
                <i className="fas fa-users-gear mr-1"></i>Admin
              </button>
              <button
                onClick={() => handleDemoLogin('supervisor')}
                className="bg-slate-600 hover:bg-slate-700 text-white py-2 px-3 rounded-lg text-xs font-medium transition-colors"
              >
                <i className="fas fa-chart-line mr-1"></i>Supervisor
              </button>
            </div>
          </div>
        )}

        {/* Version */}
        <p className="text-center text-slate-500 text-xs mt-6">
          Billing Request OS v1.0 • © 2024 Midwest Service Bureau
          {isDevMode && <span className="ml-2 text-amber-400">(Dev Mode)</span>}
        </p>
      </div>

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-8 text-center animate-fadeIn">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-check text-emerald-600 text-2xl"></i>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Welcome Back!</h3>
              <p className="text-slate-500 mb-6">{successMessage}</p>
              <div className="flex items-center justify-center space-x-2 text-blue-600">
                <i className="fas fa-spinner fa-spin"></i>
                <span className="text-sm">Redirecting to dashboard...</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keyframe animations via style tag */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-shake { animation: shake 0.5s ease-in-out; }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
      `}</style>
    </div>
  );
}
