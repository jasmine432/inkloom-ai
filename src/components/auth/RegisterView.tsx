import React, { useState } from 'react';
import { Feather, Eye, EyeOff, AlertCircle, ArrowRight, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';

interface RegisterViewProps {
  onNavigate: (path: string) => void;
}

export const RegisterView: React.FC<RegisterViewProps> = ({ onNavigate }) => {
  const { register, isFirebaseConfigured } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validation rules
  const hasMinLength = password.length >= 8;
  const hasMixedChars = /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      setError('Please provide your full name.');
      return;
    }
    if (!cleanEmail) {
      setError('Please provide a valid email address.');
      return;
    }
    if (!hasMinLength) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (!hasMixedChars) {
      setError('Password must include both letters and numbers.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your confirmation password.');
      return;
    }

    setLoading(true);
    try {
      const result = await register(cleanName, cleanEmail, password);
      if (result.success) {
        // Direct newly registered users to email verification
        onNavigate('/verify-email');
      } else {
        setError(result.error || 'Failed to create your account.');
      }
    } catch {
      setError('An unexpected error occurred while creating your account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F5F0] flex flex-col py-8 sm:py-12 px-4 sm:px-6 lg:px-8 font-sans text-[#211F1B]">
      <div className="my-auto w-full max-w-md mx-auto">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
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

          <h1 className="mt-5 text-center text-2xl font-bold tracking-tight text-stone-900">
            Create your account
          </h1>
          <p className="mt-2 text-center text-xs sm:text-sm text-stone-600">
            Start verifying marketing drafts with verifiable brand citations
          </p>
        </div>

        <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-[#FAF9F5] border border-stone-200/90 py-8 px-6 sm:px-10 shadow-xs rounded-2xl">
          {!isFirebaseConfigured && (
            <div className="mb-5 p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Development Simulation Mode</p>
                <p className="mt-0.5 text-stone-600">
                  Firebase configuration not detected in <code className="bg-amber-100/60 px-1 py-0.5 rounded text-[11px]">.env</code>. You can register any email to test registration.
                </p>
              </div>
            </div>
          )}

          {/* Security Notice: Never use Google Account Password */}
          <div className="mb-5 p-3 rounded-xl bg-stone-100/80 border border-stone-200 text-stone-700 text-xs flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-stone-800 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-stone-900">Separate Inkloom Password:</span>{' '}
              <span>
                You may register with your Gmail address or work email. Create a unique password for Inkloom AI—<strong>never</strong> enter your actual Google account password.
              </span>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="register-name"
                className="block text-xs font-semibold text-stone-800 uppercase tracking-wider mb-1.5"
              >
                Full Name
              </label>
              <input
                id="register-name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm focus:outline-none focus:ring-1 focus:ring-stone-900 focus:border-stone-900 transition-colors placeholder:text-stone-400"
              />
            </div>

            <div>
              <label
                htmlFor="register-email"
                className="block text-xs font-semibold text-stone-800 uppercase tracking-wider mb-1.5"
              >
                Email address
              </label>
              <input
                id="register-email"
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
              <label
                htmlFor="register-password"
                className="block text-xs font-semibold text-stone-800 uppercase tracking-wider mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create an Inkloom password"
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

              {/* Password criteria checklist */}
              <div className="mt-2 space-y-1 text-[11px] text-stone-500">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${hasMinLength ? 'text-emerald-600' : 'text-stone-300'}`}
                  />
                  <span className={hasMinLength ? 'text-stone-800' : ''}>At least 8 characters</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${hasMixedChars ? 'text-emerald-600' : 'text-stone-300'}`}
                  />
                  <span className={hasMixedChars ? 'text-stone-800' : ''}>Includes letters and numbers</span>
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="register-confirm-password"
                className="block text-xs font-semibold text-stone-800 uppercase tracking-wider mb-1.5"
              >
                Confirm Password
              </label>
              <input
                id="register-confirm-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm focus:outline-none focus:ring-1 focus:ring-stone-900 focus:border-stone-900 transition-colors placeholder:text-stone-400"
              />
              {confirmPassword && (
                <p className={`mt-1 text-[11px] ${passwordsMatch ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {passwordsMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-medium text-sm shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating account...</span>
                </>
              ) : (
                <>
                  <span>Create account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-stone-200/80 text-center">
            <p className="text-xs sm:text-sm text-stone-600">
              Already have an account?{' '}
              <button
                onClick={() => onNavigate('/login')}
                className="font-semibold text-stone-900 hover:underline inline-flex items-center gap-1"
              >
                Sign in
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
