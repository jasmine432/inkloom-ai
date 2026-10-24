import React, { useState, useEffect } from 'react';
import {
  Mail,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  Clock,
  Key,
  LogOut,
  ArrowLeft,
  CheckCircle2,
  Server,
  Loader2,
  RefreshCw,
  Database,
  Layers,
} from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { fetchVerifiedProfile, checkBackendHealth } from '../../services/api';
import type { VerifiedUserProfile, BackendHealth } from '../../services/api';

interface ProfileViewProps {
  onNavigate: (path: string) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ onNavigate }) => {
  const { user, idToken, logout, reloadUser } = useAuth();
  const [backendVerification, setBackendVerification] = useState<VerifiedUserProfile | null>(null);
  const [backendHealth, setBackendHealth] = useState<BackendHealth | null>(null);
  const [verifyingBackend, setVerifyingBackend] = useState(() => Boolean(idToken));
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);

  // Independently verify token with FastAPI backend and check DB health
  useEffect(() => {
    let isMounted = true;
    if (idToken) {
      fetchVerifiedProfile(idToken)
        .then((res) => {
          if (isMounted) setBackendVerification(res);
        })
        .finally(() => {
          if (isMounted) setVerifyingBackend(false);
        });
    }

    checkBackendHealth().then((health) => {
      if (isMounted && health) {
        setBackendHealth(health);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [idToken]);

  const handleRefreshEmailStatus = async () => {
    setCheckingEmail(true);
    setRefreshMsg(null);
    try {
      const isVerified = await reloadUser();
      setRefreshMsg(
        isVerified
          ? 'Email confirmed as verified!'
          : 'Email is still unverified. Please check your inbox for the link.'
      );
    } catch {
      setRefreshMsg('Unable to refresh verification status.');
    } finally {
      setCheckingEmail(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    onNavigate('/login');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F7F5F0] flex flex-col items-center justify-center p-6 text-center">
        <p className="text-stone-700 text-sm mb-4">You are not signed in.</p>
        <button
          onClick={() => onNavigate('/login')}
          className="px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-semibold"
        >
          Go to Sign In
        </button>
      </div>
    );
  }

  const initials = user.displayName
    ? user.displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'U';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 font-sans text-[#211F1B]">
      {/* Top back navigation */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => onNavigate('/dashboard')}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>

        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-stone-700 text-xs font-medium transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Profile Header Card */}
      <div className="bg-[#FAF9F5] border border-stone-200/90 rounded-2xl p-6 sm:p-8 shadow-xs mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-stone-900 text-white flex items-center justify-center font-bold text-xl shadow-xs ring-4 ring-stone-200/60">
              {initials}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
                {user.displayName || 'Inkloom AI User'}
              </h1>
              <p className="text-xs sm:text-sm text-stone-600 flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3.5 h-3.5 text-stone-400" />
                <span>{user.email}</span>
              </p>
            </div>
          </div>

          <div>
            {user.emailVerified ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Verified Account</span>
              </span>
            ) : (
              <div className="flex flex-col sm:items-end gap-1.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200 shadow-2xs">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span>Unverified Email</span>
                </span>
                <button
                  onClick={() => onNavigate('/verify-email')}
                  className="text-[11px] font-semibold text-stone-900 underline hover:text-stone-700"
                >
                  Verify your email →
                </button>
              </div>
            )}
          </div>
        </div>

        {refreshMsg && (
          <div className="mt-4 p-2.5 rounded-xl bg-stone-100 border border-stone-200 text-xs text-stone-800 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-stone-700" />
            <span>{refreshMsg}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Account Details */}
        <div className="bg-[#FAF9F5] border border-stone-200/90 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-200/80 pb-3">
            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
              Account Credentials
            </h2>
            <button
              onClick={handleRefreshEmailStatus}
              disabled={checkingEmail}
              className="text-xs text-stone-600 hover:text-stone-900 inline-flex items-center gap-1"
              title="Refresh verification status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingEmail ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="space-y-3.5 text-xs">
            <div>
              <span className="text-stone-500 block mb-0.5">Firebase UID</span>
              <span className="font-mono bg-stone-200/60 border border-stone-300 px-2 py-1 rounded text-[11px] text-stone-900 break-all select-all">
                {user.uid}
              </span>
            </div>

            <div>
              <span className="text-stone-500 block mb-0.5">Full Name</span>
              <span className="font-medium text-stone-900">{user.displayName || 'Not specified'}</span>
            </div>

            <div>
              <span className="text-stone-500 block mb-0.5">Email Address</span>
              <span className="font-medium text-stone-900">{user.email}</span>
            </div>

            <div className="flex items-center gap-4 pt-1">
              <div>
                <span className="text-stone-500 block mb-0.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Created</span>
                </span>
                <span className="text-stone-800 font-medium">
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Active session'}
                </span>
              </div>

              <div>
                <span className="text-stone-500 block mb-0.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Last Sign In</span>
                </span>
                <span className="text-stone-800 font-medium">
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Current session'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Backend Independent Verification Card */}
        <div className="bg-[#FAF9F5] border border-stone-200/90 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-200/80 pb-3">
            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-2">
              <Server className="w-4 h-4 text-stone-700" />
              <span>Server-Side Verification</span>
            </h2>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-stone-200 text-stone-800">
              FastAPI + Admin SDK
            </span>
          </div>

          <p className="text-xs text-stone-600 leading-relaxed">
            Inkloom AI never trusts frontend authentication flags alone. The FastAPI backend independently checks token signatures, audience, issuer, and claims via <code className="bg-stone-200/70 px-1 py-0.5 rounded text-[11px]">GET /api/auth/me</code>.
          </p>

          <div className="space-y-3 text-xs bg-white p-3.5 rounded-xl border border-stone-200">
            {verifyingBackend ? (
              <div className="flex items-center gap-2 text-stone-500 py-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying token with backend server...</span>
              </div>
            ) : backendVerification ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">Backend Verified Status:</span>
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Validated</span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">Verified UID:</span>
                  <span className="font-mono text-[11px] text-stone-900">{backendVerification.uid}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">Email Verified Claim:</span>
                  <span className={backendVerification.email_verified ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                    {backendVerification.email_verified ? 'True (Verified)' : 'False (Pending)'}
                  </span>
                </div>
              </>
            ) : (
              <div className="text-stone-500 py-2">
                <span>FastAPI backend not reachable or running in mock simulation.</span>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              onClick={() => onNavigate('/forgot-password')}
              className="text-xs font-semibold text-stone-900 hover:underline flex items-center gap-1.5"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Change or reset your password</span>
            </button>
          </div>
        </div>
      </div>

      {/* Database & Persistence Architecture Card */}
      <div className="mt-6 bg-[#FAF9F5] border border-stone-200/90 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-stone-200/80 pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-stone-800" />
            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
              PostgreSQL Persistence & Security
            </h2>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-200 text-stone-800">
            {backendHealth?.dbDialect === 'postgresql' || backendHealth?.dbStatus === 'postgresql_connected'
              ? (backendHealth?.dbName ? `PostgreSQL (${backendHealth.dbName})` : 'PostgreSQL Connected')
              : backendHealth?.isDbConfigured
              ? 'Database Connected'
              : 'Local SQLite Fallback'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="bg-white p-3.5 rounded-xl border border-stone-200 space-y-1">
            <div className="flex items-center gap-1.5 text-stone-500 font-medium">
              <Layers className="w-3.5 h-3.5" />
              <span>Identity Isolation</span>
            </div>
            <p className="text-stone-900 font-semibold">Firebase UID Foreign Keys</p>
            <p className="text-stone-500 text-[11px]">
              Every review, finding, and evidence citation is linked to <code className="font-mono">user_id</code>. Zero passwords stored in PostgreSQL.
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-stone-200 space-y-1">
            <div className="flex items-center gap-1.5 text-stone-500 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>FastAPI Authorization</span>
            </div>
            <p className="text-stone-900 font-semibold">Server-Side Ownership</p>
            <p className="text-stone-500 text-[11px]">
              Strict row-level tenancy enforcement on every read, write, decision patch, and delete operation.
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-stone-200 space-y-1">
            <div className="flex items-center gap-1.5 text-stone-500 font-medium">
              <Database className="w-3.5 h-3.5 text-stone-700" />
              <span>Credential Protection</span>
            </div>
            <p className="text-stone-900 font-semibold">Strictly Server-Side</p>
            <p className="text-stone-500 text-[11px]">
              Supabase connection strings and service-role keys are never exposed in frontend code or client bundles.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

