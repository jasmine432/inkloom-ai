import React, { useState, useEffect } from 'react';
import type { UserProfile, AuthContextType } from '../types/auth';
import { AuthContext } from './AuthContextDefinition';
import {
  auth,
  isFirebaseConfigured,
  registerUser,
  loginUser,
  logoutUser,
  sendVerification,
  sendPasswordReset as fbSendPasswordReset,
  confirmPasswordReset as fbConfirmPasswordReset,
  verifyEmailWithActionCode as fbVerifyEmailWithActionCode,
  getUserToken,
  toUserProfile,
} from '../services/firebase';
import { onIdTokenChanged } from 'firebase/auth';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (!auth) {
      try {
        const stored = localStorage.getItem('inkloom_mock_auth_user');
        return stored ? (JSON.parse(stored) as UserProfile) : null;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [idToken, setIdToken] = useState<string | null>(() => {
    if (!auth) {
      try {
        const stored = localStorage.getItem('inkloom_mock_auth_user');
        if (stored) {
          const parsed = JSON.parse(stored) as UserProfile;
          return parsed.emailVerified ? `sim_token_${parsed.uid}` : `sim_token_unverified_${parsed.uid}`;
        }
      } catch {}
    }
    return null;
  });

  const [loading, setLoading] = useState(Boolean(auth));

  useEffect(() => {
    if (auth) {
      const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          try {
            const token = await firebaseUser.getIdToken();
            setUser(toUserProfile(firebaseUser));
            setIdToken(token);
          } catch {
            setUser(null);
            setIdToken(null);
          }
        } else {
          setUser(null);
          setIdToken(null);
        }
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await loginUser(email, password);
      if (res.success && res.user) {
        setUser(res.user);
        const token = await getUserToken();
        setIdToken(token);
        return { success: true, user: res.user };
      }
      return { success: false, error: res.error || 'Failed to sign in.' };
    } finally {
      setLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setLoading(true);
    try {
      const res = await registerUser(name, email, password);
      if (res.success && res.user) {
        setUser(res.user);
        const token = await getUserToken();
        setIdToken(token);
        return { success: true };
      }
      return { success: false, error: res.error || 'Failed to create account.' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await logoutUser();
      setUser(null);
      setIdToken(null);
    } finally {
      setLoading(false);
    }
  };

  const sendVerificationEmail = async () => {
    return await sendVerification();
  };

  const sendPasswordReset = async (email: string) => {
    return await fbSendPasswordReset(email);
  };

  const confirmReset = async (oobCode: string, newPassword: string) => {
    return await fbConfirmPasswordReset(oobCode, newPassword);
  };

  const verifyEmailWithActionCode = async (oobCode: string) => {
    const res = await fbVerifyEmailWithActionCode(oobCode);
    if (res.success) {
      await reloadUser();
    }
    return res;
  };

  const reloadUser = async (): Promise<boolean> => {
    if (auth && auth.currentUser) {
      await auth.currentUser.reload();
      const refreshed = toUserProfile(auth.currentUser);
      setUser(refreshed);
      const token = await auth.currentUser.getIdToken(true);
      setIdToken(token);
      return refreshed.emailVerified;
    }

    // Simulation mode: check stored user profile without faking verification
    if (user) {
      try {
        const stored = localStorage.getItem('inkloom_mock_auth_user');
        if (stored) {
          const parsed = JSON.parse(stored) as UserProfile;
          setUser(parsed);
          const token = parsed.emailVerified ? `sim_token_${parsed.uid}` : `sim_token_unverified_${parsed.uid}`;
          setIdToken(token);
          return parsed.emailVerified;
        }
      } catch {}
      return user.emailVerified;
    }
    return false;
  };

  const getToken = async (forceRefresh = false) => {
    return await getUserToken(forceRefresh);
  };

  const value: AuthContextType = {
    user,
    idToken,
    loading,
    isFirebaseConfigured,
    login,
    register,
    logout,
    sendVerificationEmail,
    sendPasswordReset,
    confirmReset,
    verifyEmailWithActionCode,
    reloadUser,
    getIdToken: getToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
