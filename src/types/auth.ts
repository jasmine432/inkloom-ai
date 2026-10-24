export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  photoURL?: string | null;
  createdAt?: string | null;
  lastLoginAt?: string | null;
}

export interface AuthContextType {
  user: UserProfile | null;
  idToken: string | null;
  loading: boolean;
  isFirebaseConfigured: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; user?: UserProfile; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  sendVerificationEmail: () => Promise<{ success: boolean; error?: string }>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  confirmReset: (oobCode: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  verifyEmailWithActionCode: (oobCode: string) => Promise<{ success: boolean; error?: string }>;
  reloadUser: () => Promise<boolean>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
}
