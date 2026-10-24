import React, { useState, useEffect, useRef } from 'react';
import { Feather, Mail, CheckCircle2, AlertCircle, RefreshCw, ArrowRight, LogOut, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';

interface VerifyEmailViewProps {
  onNavigate: (path: string) => void;
}

export const VerifyEmailView: React.FC<VerifyEmailViewProps> = ({ onNavigate }) => {
  const {
    user,
    reloadUser,
    sendVerificationEmail,
    verifyEmailWithActionCode,
    logout,
    isFirebaseConfigured,
  } = useAuth();

  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const codeProcessedRef = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // If already verified, redirect to dashboard
  useEffect(() => {
    if (user && user.emailVerified) {
      onNavigate('/dashboard');
    }
  }, [user, onNavigate]);

  // Handle Firebase action URL parameters (mode=verifyEmail & oobCode=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const oobCode = params.get('oobCode');

    if (mode === 'verifyEmail' && oobCode && !codeProcessedRef.current) {
      codeProcessedRef.current = true;
      setVerifyingCode(true);
      setError(null);
      setMessage('Verifying your email address with Firebase Authentication...');

      verifyEmailWithActionCode(oobCode)
        .then((res) => {
          if (res.success) {
            setMessage('Your email address has been verified successfully! Redirecting to dashboard...');
            // Clean up query parameters without full page reload
            window.history.replaceState({}, '', window.location.pathname);
            setTimeout(() => {
              onNavigate('/dashboard');
            }, 1500);
          } else {
            setError(res.error || 'Verification code is invalid or has expired. Please request a new verification email.');
          }
        })
        .catch(() => {
          setError('Failed to verify code. The link may have expired or was already used.');
        })
        .finally(() => {
          setVerifyingCode(false);
        });
    }
  }, [verifyEmailWithActionCode, onNavigate]);

  // Cooldown countdown effect
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError(null);
    setMessage(null);

    try {
      const res = await sendVerificationEmail();
      if (res.success) {
        setMessage('A genuine verification email has been dispatched to your inbox.');
        setCooldown(60); // 60 seconds cooldown
      } else {
        setError(res.error || 'Could not send verification email. Please check your configuration.');
      }
    } catch {
      setError('An unexpected error occurred while resending the verification email.');
    } finally {
      setResending(false);
    }
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    setError(null);
    setMessage(null);

    try {
      const isVerified = await reloadUser();
      if (isVerified) {
        setMessage('Email verified successfully! Redirecting...');
        setTimeout(() => {
          onNavigate('/dashboard');
        }, 1200);
      } else {
        if (!isFirebaseConfigured) {
          setError(
            'Firebase Authentication is running in Development Simulation Mode. No real email was delivered because VITE_FIREBASE_* is not configured in root .env. Use the simulation control below or configure .env.'
          );
        } else {
          setError('Your email is not verified yet. Please check your inbox or spam folder for the link, or request a new one.');
        }
      }
    } catch {
      setError('Failed to refresh status from Firebase. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  // Explicit simulation verification helper strictly for offline dev testing
  const handleDevSimulateVerification = async () => {
    setError(null);
    setMessage(null);
    const res = await verifyEmailWithActionCode('dev_sim_code');
    if (res.success) {
      setMessage('Development simulation: email verified locally. Redirecting...');
      setTimeout(() => {
        onNavigate('/dashboard');
      }, 1000);
    } else {
      setError('Could not apply simulation verification.');
    }
  };

  const handleSignOut = async () => {
    await logout();
    onNavigate('/login');
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
            Verify your email address
          </h1>
          <p className="mt-2 text-center text-xs sm:text-sm text-stone-600">
            Email verification is required before full application review access
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-[#FAF9F5] border border-stone-200/90 py-8 px-6 sm:px-10 shadow-xs rounded-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-100/70 border border-amber-200/80 text-amber-800 flex items-center justify-center mx-auto mb-5 shadow-xs">
              {verifyingCode ? (
                <Loader2 className="w-7 h-7 animate-spin text-amber-700" />
              ) : (
                <Mail className="w-7 h-7" />
              )}
            </div>

            {!isFirebaseConfigured && (
              <div className="mb-5 p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs text-left flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Development Simulation Mode</p>
                  <p className="mt-0.5 text-stone-600">
                    Firebase public keys are not configured in <code className="bg-amber-100/60 px-1 py-0.5 rounded text-[11px]">.env</code>. Real emails cannot be sent. To send genuine verification emails, add <code className="bg-amber-100/60 px-1 py-0.5 rounded text-[11px]">VITE_FIREBASE_*</code> to root <code className="bg-amber-100/60 px-1 py-0.5 rounded text-[11px]">.env</code>.
                  </p>
                </div>
              </div>
            )}

            <p className="text-sm text-stone-700 leading-relaxed mb-2">
              We sent a verification link to:
            </p>
            <div className="inline-block px-3.5 py-1.5 rounded-lg bg-stone-200/60 border border-stone-300 text-xs font-semibold text-stone-900 font-mono mb-6">
              {user?.email || 'your registered email'}
            </div>

            <p className="text-xs text-stone-500 leading-relaxed mb-6">
              Please click the link in your email to confirm your identity. If you don't see it, check your spam or junk folder.
            </p>

            {message && (
              <div
                role="status"
                className="mb-5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{message}</span>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2 text-left"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handleCheckStatus}
                disabled={checking || verifyingCode}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-medium text-sm shadow-xs transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
                <span>{checking ? 'Checking verification...' : "I've verified my email — Check status"}</span>
              </button>

              <button
                onClick={handleResend}
                disabled={resending || cooldown > 0 || verifyingCode}
                className="w-full py-2 px-4 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 font-medium text-xs shadow-2xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cooldown > 0
                  ? `Resend available in ${cooldown}s`
                  : resending
                  ? 'Sending link...'
                  : 'Resend verification email'}
              </button>

              {!isFirebaseConfigured && (
                <div className="pt-2">
                  <button
                    onClick={handleDevSimulateVerification}
                    type="button"
                    className="w-full py-2 px-3 rounded-xl border border-dashed border-amber-300 bg-amber-50/50 hover:bg-amber-100/50 text-amber-800 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Simulate verification link click (Offline Dev Only)</span>
                  </button>
                </div>
              )}
            </div>

            <div className="mt-6 pt-5 border-t border-stone-200/80 flex items-center justify-between text-xs text-stone-500">
              <button
                onClick={() => onNavigate('/dashboard')}
                className="hover:text-stone-900 inline-flex items-center gap-1"
              >
                <span>Dashboard preview</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleSignOut}
                className="text-stone-600 hover:text-stone-900 inline-flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
