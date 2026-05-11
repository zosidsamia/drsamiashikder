import { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export function useFirebaseAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  // Listen to auth state changes
  useEffect(() => {
    if (!auth) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setState({
        user,
        loading: false,
        error: null,
      });
    });

    return () => unsubscribe();
  }, []);

  // Sign up with email and password
  const signUp = async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase not initialized');
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const result = await createUserWithEmailAndPassword(auth, email, password);
      setState({ user: result.user, loading: false, error: null });
      return result.user;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign up failed';
      setState((prev) => ({ ...prev, loading: false, error: message }));
      throw error;
    }
  };

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase not initialized');
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const result = await signInWithEmailAndPassword(auth, email, password);
      setState({ user: result.user, loading: false, error: null });
      return result.user;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign in failed';
      setState((prev) => ({ ...prev, loading: false, error: message }));
      throw error;
    }
  };

  // Sign out
  const signOut = async () => {
    if (!auth) throw new Error('Firebase not initialized');
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      await firebaseSignOut(auth);
      setState({ user: null, loading: false, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign out failed';
      setState((prev) => ({ ...prev, loading: false, error: message }));
      throw error;
    }
  };

  return {
    ...state,
    signUp,
    signIn,
    signOut,
  };
}