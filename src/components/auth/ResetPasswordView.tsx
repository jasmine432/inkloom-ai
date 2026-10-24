import React, { useState } from 'react';
import { Feather, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, Loader2, KeyRound } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';

interface ResetPasswordViewProps {
  onNavigate: (path: string) => void;
}

export const ResetPasswordView: React.FC<ResetPasswordViewProps> = ({ onNavigate }) => {
  const { confirmReset, isFirebaseConfigured } = useAuth();
  const [oobCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('oobCode') || '';
  });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('oobCode');
    if (!code && isFirebaseConfigured) {
      return 'Invalid or missing password reset code in the URL. Please request a new reset link.';
    }
    return null;
  });

  const hasMinLength = password.length >= 8;
  const hasMixedChars = /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!hasMinLength) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (!hasMixedChars) {
      setError('Password must include both letters and numbers.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await confirmReset(oobCode || 'sim_code', password);
      if (res.success) {
        setSuccess(true);
      } else {
        setError(res.error || 'Failed to reset password. The link may have expired.');
      }
    } catch {
      setError('An unexpected error occurred while resetting your password.');
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

          <h1 className="mt-6 text-center text-2xl font-bold tracking-tight text-stone-900">
            Set new password
          </h1>
          <p className="mt-2 text-center text-xs sm:text-sm text-stone-600">
            Choose a new password for your Inkloom AI account
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-[#FAF9F5] border border-stone-200/90 py-8 px-6 sm:px-10 shadow-xs rounded-2xl">
          {success ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100/70 border border-emerald-200 text-emerald-800 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>

              <h2 className="text-base font-bold text-stone-900">Password reset complete</h2>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                Your password has been securely updated. You can now sign in with your new credentials.
              </p>

              <div className="pt-4">
                <button
                  onClick={() => onNavigate('/login')}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-medium text-sm shadow-xs transition-colors"
                >
                  <span>Sign in with new password</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {error && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="new-password"
                  className="block text-xs font-semibold text-stone-800 uppercase tracking-wider mb-1.5"
                >
                  New password
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
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
                    <span className={hasMixedChars ? 'text-stone-800' : ''}>Letters and numbers</span>
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirm-new-password"
                  className="block text-xs font-semibold text-stone-800 uppercase tracking-wider mb-1.5"
                >
                  Confirm new password
                </label>
                <input
                  id="confirm-new-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
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
                    <span>Updating password...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Reset password</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  </div>
);
};
