import React, { useState } from 'react';
import { Feather, Eye, EyeOff, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';

interface LoginViewProps {
  onNavigate: (path: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onNavigate }) => {
  const { login, isFirebaseConfigured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const result = await login(cleanEmail, password);
      if (result.success) {
        if (result.user && !result.user.emailVerified) {
          onNavigate('/verify-email');
        } else {
          onNavigate('/dashboard');
        }
      } else {
        setError(result.error || 'Failed to sign in. Please verify your credentials.');
      }
    } catch {
      setError('An unexpected error occurred during sign-in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F5F0] flex flex-col py-8 sm:py-12 px-4 sm:px-6 lg:px-8 font-sans text-[#211F1B]">
      <div className="my-auto w-full max-w-md mx-auto">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          {/* Brand Header */}
          <div className="flex justify-center">
            <button
              onClick={() => onNavigate('/dashboard')}
              className="flex items-center gap-2.5 group focus:outline-none"
            >
              <div className="w-10 h-10 rounded-xl bg-stone-900 text-white flex items-center justify-center shadow-xs">
                <Feather className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="text-xl font-bold text-stone-900 tracking-tight font-sans">
                Inkloom AI
              </span>
            </button>
          </div>

          <h1 className="mt-6 text-center text-2xl font-bold tracking-tight text-stone-900">
            Sign in to your account
          </h1>
          <p className="mt-2 text-center text-xs sm:text-sm text-stone-600">
            Auditing marketing claims against verified brand guidelines
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-[#FAF9F5] border border-stone-200/90 py-8 px-6 sm:px-10 shadow-xs rounded-2xl">
          {!isFirebaseConfigured && (
            <div className="mb-6 p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Development Simulation Mode</p>
                <p className="mt-0.5 text-stone-600">
                  Firebase public keys are not configured in <code className="bg-amber-100/60 px-1 py-0.5 rounded text-[11px]">.env</code>. You can register any email to explore the full auth workflow locally.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mb-6 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label
                htmlFor="email-input"
                className="block text-xs font-semibold text-stone-800 uppercase tracking-wider mb-1.5"
              >
                Email address
              </label>
              <input
                id="email-input"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com or name@gmail.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm focus:outline-none focus:ring-1 focus:ring-stone-900 focus:border-stone-900 transition-colors placeholder:text-stone-400"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password-input"
                  className="block text-xs font-semibold text-stone-800 uppercase tracking-wider"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => onNavigate('/forgot-password')}
                  className="text-xs font-medium text-stone-600 hover:text-stone-900 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="password-input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your Inkloom AI password"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm focus:outline-none focus:ring-1 focus:ring-stone-900 focus:border-stone-900 transition-colors placeholder:text-stone-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-medium text-sm shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-stone-200/80 text-center">
            <p className="text-xs sm:text-sm text-stone-600">
              Don't have an account?{' '}
              <button
                onClick={() => onNavigate('/register')}
                className="font-semibold text-stone-900 hover:underline inline-flex items-center gap-1"
              >
                Create one now
              </button>
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => onNavigate('/dashboard')}
            className="text-xs text-stone-500 hover:text-stone-800"
          >
            ← Return to dashboard
          </button>
        </div>
        </div>
      </div>
    </div>
  );
};
