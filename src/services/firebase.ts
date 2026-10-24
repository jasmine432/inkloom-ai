import { initializeApp, getApps, getApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  confirmPasswordReset as fbConfirmPasswordReset,
  applyActionCode as fbApplyActionCode,
  updateProfile,
  onIdTokenChanged,
  getIdToken,
} from 'firebase/auth';
import type { Auth, User } from 'firebase/auth';
import type { UserProfile } from '../types/auth';

// Public Firebase Web configuration read from Vite environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/**
 * Validates whether real public Firebase configuration is supplied.
 */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== 'AIzaSyExamplePlaceholderApiKey' &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId !== 'inkloom-ai-example' &&
  firebaseConfig.authDomain &&
  !firebaseConfig.authDomain.includes('inkloom-ai-example')
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
  } catch (err) {
    console.error('Failed to initialize Firebase Client SDK:', err);
    app = null;
    auth = null;
  }
} else {
  // Helpful diagnostic log in browser console for developers
  console.info(
    '[Inkloom AI Auth] Firebase client is running in Development Simulation Mode. Configure VITE_FIREBASE_* in root .env to enable live Firebase Authentication.'
  );
}

export { auth };

/**
 * Returns the action code settings ensuring verification emails redirect back
 * to the Inkloom AI application route.
 */
export function getActionCodeSettings() {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  return {
    url: `${origin}/verify-email`,
    handleCodeInApp: true,
  };
}

/**
 * Maps Firebase error codes to helpful, user-friendly editorial messages.
 */
export function formatAuthError(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return 'An unexpected authentication error occurred. Please try again.';
  }

  const code = (error as { code: string }).code;
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists. Please log in or reset your password.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password. Please verify your credentials and try again.';
    case 'auth/weak-password':
      return 'Password must be at least 8 characters long and contain letters and numbers.';
    case 'auth/too-many-requests':
      return 'Too many requests sent. For security, please wait a minute before requesting another email or signing in.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact Inkloom AI support.';
    case 'auth/expired-action-code':
      return 'This verification or password reset link has expired. Please request a new one.';
    case 'auth/invalid-action-code':
      return 'This verification or password reset link is invalid or has already been used.';
    case 'auth/network-request-failed':
      return 'Network connection issue. Please check your internet connection and try again.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized in Firebase Console (Authentication > Settings > Authorized domains). Please add this domain.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled in Firebase Console. Please enable Email/Password under Authentication > Sign-in method.';
    case 'auth/requires-recent-login':
      return 'This action requires a recent sign-in. Please log out and sign back in.';
    case 'auth/quota-exceeded':
      return 'Firebase email quota exceeded. Please wait a short while or upgrade your project quota.';
    default:
      return (error as { message?: string }).message || 'Authentication error occurred.';
  }
}

/**
 * Converts a Firebase User instance to the standard Inkloom UserProfile model.
 */
export function toUserProfile(user: User): UserProfile {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'User'),
    emailVerified: user.emailVerified,
    photoURL: user.photoURL,
    createdAt: user.metadata.creationTime,
    lastLoginAt: user.metadata.lastSignInTime,
  };
}

// ---------------------------------------------------------------------------
// Local Simulation Storage for unconfigured development environments
// Allows developers/evaluators to test the full auth flow offline before setting up Firebase credentials
// ---------------------------------------------------------------------------

const MOCK_AUTH_STORAGE_KEY = 'inkloom_mock_auth_user';

interface MockUserStore {
  uid: string;
  email: string;
  displayName: string;
  passwordHash: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string;
}

function getMockUsers(): MockUserStore[] {
  try {
    const raw = localStorage.getItem('inkloom_mock_registered_users');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMockUsers(users: MockUserStore[]) {
  try {
    localStorage.setItem('inkloom_mock_registered_users', JSON.stringify(users));
  } catch {}
}

function getActiveMockUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(MOCK_AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setActiveMockUser(user: UserProfile | null) {
  try {
    if (user) {
      localStorage.setItem(MOCK_AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(MOCK_AUTH_STORAGE_KEY);
    }
  } catch {}
}

// ---------------------------------------------------------------------------
// Auth Operations
// ---------------------------------------------------------------------------

/**
 * Registers a new user with name, email, and password.
 * Automatically sends an email verification link when Firebase is configured.
 */
export async function registerUser(name: string, email: string, password: string) {
  if (auth) {
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      if (name.trim()) {
        await updateProfile(userCred.user, { displayName: name.trim() });
      }
      
      let emailSent = false;
      let emailError: string | undefined;
      try {
        await sendEmailVerification(userCred.user, getActionCodeSettings());
        emailSent = true;
      } catch (sendErr) {
        emailError = formatAuthError(sendErr);
        console.warn('Initial verification email sending failed on registration:', sendErr);
      }

      return {
        success: true,
        user: toUserProfile(userCred.user),
        emailSent,
        emailError,
      };
    } catch (err) {
      return { success: false, error: formatAuthError(err) };
    }
  }

  // Simulation mode when Firebase credentials are not yet configured in .env
  const mockUsers = getMockUsers();
  if (mockUsers.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return {
      success: false,
      error: 'An account with this email address already exists. Please log in or reset your password.',
    };
  }

  const now = new Date().toISOString();
  const newMockUser: MockUserStore = {
    uid: `sim_usr_${Math.random().toString(36).substring(2, 10)}`,
    email: email.trim(),
    displayName: name.trim() || email.split('@')[0],
    passwordHash: btoa(password),
    emailVerified: false,
    createdAt: now,
    lastLoginAt: now,
  };

  mockUsers.push(newMockUser);
  saveMockUsers(mockUsers);

  const profile: UserProfile = {
    uid: newMockUser.uid,
    email: newMockUser.email,
    displayName: newMockUser.displayName,
    emailVerified: false,
    createdAt: now,
    lastLoginAt: now,
  };
  setActiveMockUser(profile);

  return {
    success: true,
    user: profile,
    emailSent: false,
    emailError: 'Development Simulation Mode: Live Firebase Authentication is not configured in .env. No real email sent.',
  };
}

/**
 * Logs in with email and password.
 */
export async function loginUser(email: string, password: string) {
  if (auth) {
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      return { success: true, user: toUserProfile(userCred.user) };
    } catch (err) {
      return { success: false, error: formatAuthError(err) };
    }
  }

  // Simulation mode
  const mockUsers = getMockUsers();
  const found = mockUsers.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === btoa(password)
  );

  if (!found) {
    return {
      success: false,
      error: 'Incorrect email or password. Please verify your credentials.',
    };
  }

  found.lastLoginAt = new Date().toISOString();
  saveMockUsers(mockUsers);

  const profile: UserProfile = {
    uid: found.uid,
    email: found.email,
    displayName: found.displayName,
    emailVerified: found.emailVerified,
    createdAt: found.createdAt,
    lastLoginAt: found.lastLoginAt,
  };
  setActiveMockUser(profile);

  return { success: true, user: profile };
}

/**
 * Logs out the active user and clears session state.
 */
export async function logoutUser() {
  if (auth) {
    await signOut(auth);
  } else {
    setActiveMockUser(null);
  }
}

/**
 * Sends an email verification link to the currently signed-in user.
 * Surfaces explicit errors if Firebase is unconfigured or if send fails.
 */
export async function sendVerification(): Promise<{ success: boolean; error?: string }> {
  if (auth && auth.currentUser) {
    try {
      await sendEmailVerification(auth.currentUser, getActionCodeSettings());
      return { success: true };
    } catch (err) {
      return { success: false, error: formatAuthError(err) };
    }
  }

  // Simulation mode
  const active = getActiveMockUser();
  if (active) {
    return {
      success: false,
      error: 'Firebase Authentication is running in Development Simulation Mode. Configure VITE_FIREBASE_* in root .env to enable real email delivery.',
    };
  }
  return { success: false, error: 'No authenticated user session found.' };
}

/**
 * Applies an action code received in email link to verify user email address.
 */
export async function verifyEmailWithActionCode(oobCode: string): Promise<{ success: boolean; error?: string }> {
  if (auth) {
    try {
      await fbApplyActionCode(auth, oobCode);
      if (auth.currentUser) {
        await auth.currentUser.reload();
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: formatAuthError(err) };
    }
  }

  // Development simulation mode: explicit simulation verification
  if (oobCode === 'dev_sim_code') {
    const active = getActiveMockUser();
    if (active) {
      active.emailVerified = true;
      setActiveMockUser(active);
      const mockUsers = getMockUsers();
      const idx = mockUsers.findIndex((u) => u.uid === active.uid);
      if (idx !== -1) {
        mockUsers[idx].emailVerified = true;
        saveMockUsers(mockUsers);
      }
      return { success: true };
    }
  }

  return {
    success: false,
    error: 'Invalid or expired verification action code.',
  };
}

/**
 * Sends a password reset email to the provided address.
 */
export async function sendPasswordReset(email: string) {
  if (auth) {
    try {
      await sendPasswordResetEmail(auth, email, getActionCodeSettings());
      return { success: true };
    } catch (err) {
      return { success: false, error: formatAuthError(err) };
    }
  }

  // Simulation mode
  const mockUsers = getMockUsers();
  const found = mockUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!found) {
    // Standard security practice: Don't leak whether account exists
    return { success: true };
  }
  return { success: true };
}

/**
 * Confirms password reset with an action code.
 */
export async function confirmPasswordReset(oobCode: string, newPassword: string) {
  if (auth) {
    try {
      await fbConfirmPasswordReset(auth, oobCode, newPassword);
      return { success: true };
    } catch (err) {
      return { success: false, error: formatAuthError(err) };
    }
  }

  // Simulation mode
  return { success: true };
}

/**
 * Retrieves the current Firebase ID token (JWT) to attach to backend API requests.
 */
export async function getUserToken(forceRefresh = false): Promise<string | null> {
  if (auth && auth.currentUser) {
    try {
      return await getIdToken(auth.currentUser, forceRefresh);
    } catch {
      return null;
    }
  }

  const active = getActiveMockUser();
  if (active) {
    return active.emailVerified ? `sim_token_${active.uid}` : `sim_token_unverified_${active.uid}`;
  }
  return null;
}

/**
 * Subscribes to authentication state changes.
 */
export function subscribeToAuthState(
  onUserChanged: (user: UserProfile | null, token: string | null) => void
) {
  if (auth) {
    return onIdTokenChanged(auth, async (fbUser) => {
      if (fbUser) {
        const token = await fbUser.getIdToken();
        onUserChanged(toUserProfile(fbUser), token);
      } else {
        onUserChanged(null, null);
      }
    });
  }

  // Simulation mode: check localStorage
  const active = getActiveMockUser();
  if (active) {
    const token = active.emailVerified ? `sim_token_${active.uid}` : `sim_token_unverified_${active.uid}`;
    onUserChanged(active, token);
  } else {
    onUserChanged(null, null);
  }

  return () => {};
}
