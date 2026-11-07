import React, { createContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  demoLogin: () => Promise<void>;
  register: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  loginWithGoogle: async () => {},
  demoLogin: async () => {},
  register: async () => {},
  logout: async () => {},
  resetPassword: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (currentUser) {
          try {
            // Validate that the persisted session token is authentic for the current project
            await currentUser.getIdToken(false);
            setUser(currentUser);
          } catch (tokenErr) {
            console.warn('[PatentAI Auth] Stale or invalid cached session token. Purging session...', tokenErr);
            try {
              await firebaseSignOut(auth);
            } catch (_) {}
            setUser(null);
          }
        } else {
          setUser(null);
        }
        setLoading(false);
      },
      (error) => {
        console.warn('[PatentAI Auth] Auth observer notice:', error);
        setUser(null);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  const login = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), pass);
  };

  const loginWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const demoLogin = async () => {
    // Quick demo login for testing and portfolio reviews
    await signInWithEmailAndPassword(auth, 'test@example.com', 'password123');
  };

  const register = async (email: string, pass: string) => {
    await createUserWithEmailAndPassword(auth, email.trim(), pass);
  };

  const logout = async () => {
    await firebaseSignOut(auth);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        loginWithGoogle,
        demoLogin,
        register,
        logout,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
