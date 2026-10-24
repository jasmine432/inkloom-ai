import React, { useState } from 'react';
import { Feather, Mail, CheckCircle2, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';

interface ForgotPasswordViewProps {
  onNavigate: (path: string) => void;
}

export const ForgotPasswordView: React.FC<ForgotPasswordViewProps> = ({ onNavigate }) => {
  const { sendPasswordReset, isFirebaseConfigured } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await sendPasswordReset(cleanEmail);
      if (res.success) {
        setSubmitted(true);
      } else {
        setError(res.error || 'Failed to send password reset email.');
      }
    } catch {
      setError('An unexpected error occurred while requesting password reset.');
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
            Reset your password
          </h1>
          <p className="mt-2 text-center text-xs sm:text-sm text-stone-600">
            Enter your registered email and we'll send you a secure reset link
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-[#FAF9F5] border border-stone-200/90 py-8 px-6 sm:px-10 shadow-xs rounded-2xl">
          {!isFirebaseConfigured && (
            <div className="mb-5 p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Development Simulation Mode</p>
                <p className="mt-0.5 text-stone-600">
                  Firebase public keys are not configured in <code className="bg-amber-100/60 px-1 py-0.5 rounded text-[11px]">.env</code>. The reset flow will complete simulated verification.
                </p>
              </div>
            </div>
          )}

          {submitted ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100/70 border border-emerald-200 text-emerald-800 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>

              <h2 className="text-base font-bold text-stone-900">Check your inbox</h2>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                If an account exists for <strong className="text-stone-900">{email}</strong>, you will receive an email with instructions to securely reset your password.
              </p>

              <div className="pt-4">
                <button
                  onClick={() => onNavigate('/login')}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-medium text-sm shadow-xs transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Return to sign in</span>
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
                  htmlFor="forgot-email"
                  className="block text-xs font-semibold text-stone-800 uppercase tracking-wider mb-1.5"
                >
                  Email address
                </label>
                <div className="relative">
                  <input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com or name@gmail.com"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm focus:outline-none focus:ring-1 focus:ring-stone-900 focus:border-stone-900 transition-colors placeholder:text-stone-400"
                  />
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
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
                    <span>Sending reset link...</span>
                  </>
                ) : (
                  <span>Send password reset link</span>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => onNavigate('/login')}
                  className="text-xs font-medium text-stone-600 hover:text-stone-900 inline-flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to sign in</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  </div>
);
};
