"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile as updateFirebaseProfile,
  User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import {
  firebaseConfigurationMessage,
  getFirebaseServices,
} from "@/app/lib/firebase-client";

export type VerificationStatus = "unsubmitted" | "pending" | "approved" | "rejected";

export type UserProfile = {
  uid: string;
  email: string;
  fullName: string;
  emailVerified: boolean;
  studentVerified: boolean;
  verificationStatus: VerificationStatus;
  onboardingComplete: boolean;
  country?: string;
  university?: string;
  course?: string;
  headline?: string;
  bio?: string;
  skills?: string;
  portfolio?: string;
  linkedIn?: string;
  gitHub?: string;
  availability?: string;
  photoName?: string;
  photoDataUrl?: string;
  verificationMethod?: "school-email" | "student-id";
  schoolEmail?: string;
  walletAddress?: string;
  walletNetwork?: "devnet";
  completedGigCount?: number;
  ratingCount?: number;
  averageRating?: number;
  totalEarnedUsdcBaseUnits?: string;
};

export type EditableProfile = Pick<
  UserProfile,
  | "fullName"
  | "country"
  | "university"
  | "course"
  | "headline"
  | "bio"
  | "skills"
  | "portfolio"
  | "linkedIn"
  | "gitHub"
  | "availability"
  | "photoName"
  | "photoDataUrl"
>;

type AuthContextValue = {
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  configurationError: string | null;
  signUp: (fullName: string, email: string, password: string) => Promise<User>;
  signUpAdmin: (fullName: string, email: string, password: string) => Promise<User>;
  logIn: (email: string, password: string) => Promise<{ user: User; isAdmin: boolean }>;
  logOut: () => Promise<void>;
  saveProfile: (values: EditableProfile) => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSession: () => Promise<void>;
  sendAccountVerificationEmail: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function profileFromData(data: Record<string, unknown>): UserProfile {
  return {
    uid: String(data.uid ?? ""),
    email: String(data.email ?? ""),
    fullName: String(data.fullName ?? ""),
    emailVerified: data.emailVerified === true,
    studentVerified: data.studentVerified === true,
    verificationStatus: (data.verificationStatus as VerificationStatus) ?? "unsubmitted",
    onboardingComplete: data.onboardingComplete === true,
    country: String(data.country ?? ""),
    university: String(data.university ?? ""),
    course: String(data.course ?? ""),
    headline: String(data.headline ?? ""),
    bio: String(data.bio ?? ""),
    skills: String(data.skills ?? ""),
    portfolio: String(data.portfolio ?? ""),
    linkedIn: String(data.linkedIn ?? ""),
    gitHub: String(data.gitHub ?? ""),
    availability: String(data.availability ?? ""),
    photoName: String(data.photoName ?? ""),
    photoDataUrl: String(data.photoDataUrl ?? ""),
    verificationMethod: data.verificationMethod === "school-email" || data.verificationMethod === "student-id"
      ? data.verificationMethod
      : undefined,
    schoolEmail: String(data.schoolEmail ?? ""),
    walletAddress: String(data.walletAddress ?? ""),
    walletNetwork: data.walletNetwork === "devnet" ? "devnet" : undefined,
    completedGigCount: Number(data.completedGigCount ?? 0),
    ratingCount: Number(data.ratingCount ?? 0),
    averageRating: Number(data.averageRating ?? 0),
    totalEarnedUsdcBaseUnits: String(data.totalEarnedUsdcBaseUnits ?? "0"),
  };
}

export function firebaseErrorMessage(error: unknown) {
  if (!(error instanceof FirebaseError)) {
    return error instanceof Error ? error.message : "Something went wrong. Please try again.";
  }

  const messages: Record<string, string> = {
    "auth/email-already-in-use": "An account already exists for that email. Try logging in instead.",
    "auth/invalid-credential": "That email or password is incorrect.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/missing-password": "Enter your password.",
    "auth/network-request-failed": "We could not reach Firebase. Check your connection and try again.",
    "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
    "auth/weak-password": "Choose a stronger password with at least 8 characters.",
    "permission-denied": "Your profile could not be saved because access was denied.",
  };

  return messages[error.code] ?? "Authentication could not be completed. Please try again.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configurationError, setConfigurationError] = useState<string | null>(null);

  const loadProfile = useCallback(async (activeUser: User | null) => {
    if (!activeUser) {
      setProfile(null);
      return;
    }

    const { db } = await getFirebaseServices();
    const snapshot = await getDoc(doc(db, "users", activeUser.uid));
    if (!snapshot.exists()) {
      setProfile(null);
      return;
    }

    let nextProfile = profileFromData(snapshot.data());
    if (!nextProfile.walletAddress) {
      const token = await activeUser.getIdToken();
      const response = await fetch("/api/wallet", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload.error ?? "Your CampusGig wallet could not be created."));
      }
      nextProfile = {
        ...nextProfile,
        walletAddress: String(payload.walletAddress ?? ""),
        walletNetwork: "devnet",
      };
    }
    setProfile(nextProfile);
  }, []);

  const loadAdminStatus = useCallback(async (activeUser: User | null) => {
    if (!activeUser) return false;
    const token = await activeUser.getIdToken();
    const response = await fetch("/api/admin/session", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(String(payload.error ?? "Account access could not be checked."));
    }
    return payload.isAdmin === true;
  }, []);

  useEffect(() => {
    let unsubscribe: () => void = () => {};
    let active = true;

    getFirebaseServices()
      .then(({ auth }) => {
        if (!active) return;
        unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
          setUser(nextUser);
          try {
            const nextIsAdmin = await loadAdminStatus(nextUser);
            setIsAdmin(nextIsAdmin);
            if (nextIsAdmin) setProfile(null);
            else await loadProfile(nextUser);
          } catch (error) {
            setConfigurationError(firebaseErrorMessage(error));
          } finally {
            if (active) setLoading(false);
          }
        });
      })
      .catch(() => {
        if (active) {
          setConfigurationError(firebaseConfigurationMessage);
          setLoading(false);
        }
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [loadAdminStatus, loadProfile]);

  const signUp = useCallback(async (fullName: string, email: string, password: string) => {
    const { auth, db } = await getFirebaseServices();
    const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateFirebaseProfile(credential.user, { displayName: fullName.trim() });

    if (await loadAdminStatus(credential.user)) {
      await deleteUser(credential.user);
      setIsAdmin(false);
      throw new Error("Use the dedicated administrator sign-up page for this email.");
    }

    const nextProfile: UserProfile = {
      uid: credential.user.uid,
      email: credential.user.email ?? email.trim(),
      fullName: fullName.trim(),
      emailVerified: false,
      studentVerified: false,
      verificationStatus: "unsubmitted",
      onboardingComplete: false,
    };

    try {
      await setDoc(doc(db, "users", credential.user.uid), {
        ...nextProfile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const token = await credential.user.getIdToken();
      const response = await fetch("/api/wallet", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload.error ?? "Your CampusGig wallet could not be created."));
      }
      setProfile({
        ...nextProfile,
        walletAddress: String(payload.walletAddress ?? ""),
        walletNetwork: "devnet",
      });
      return credential.user;
    } catch (error) {
      try {
        const token = await credential.user.getIdToken();
        await fetch("/api/wallet", {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Authentication cleanup below still prevents the partial account from being used.
      }
      try {
        await deleteUser(credential.user);
      } catch {
        await firebaseSignOut(auth);
      }
      throw error;
    }
  }, [loadAdminStatus]);

  const signUpAdmin = useCallback(async (fullName: string, email: string, password: string) => {
    const { auth } = await getFirebaseServices();
    const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);

    try {
      await updateFirebaseProfile(credential.user, { displayName: fullName.trim() });
      const token = await credential.user.getIdToken();
      const response = await fetch("/api/admin/register", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload.error ?? "Administrator registration could not be completed."));
      }
      setProfile(null);
      setIsAdmin(true);
      return credential.user;
    } catch (error) {
      try {
        await deleteUser(credential.user);
      } catch {
        await firebaseSignOut(auth);
      }
      setIsAdmin(false);
      throw error;
    }
  }, []);

  const logIn = useCallback(async (email: string, password: string) => {
    const { auth } = await getFirebaseServices();
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    const nextIsAdmin = await loadAdminStatus(credential.user);
    setIsAdmin(nextIsAdmin);
    if (nextIsAdmin) setProfile(null);
    else await loadProfile(credential.user);
    return { user: credential.user, isAdmin: nextIsAdmin };
  }, [loadAdminStatus, loadProfile]);

  const logOut = useCallback(async () => {
    const { auth } = await getFirebaseServices();
    await firebaseSignOut(auth);
    setProfile(null);
    setIsAdmin(false);
  }, []);

  const saveProfile = useCallback(async (values: EditableProfile) => {
    if (!user) throw new Error("Log in before updating your profile.");
    const cleanValues = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, value?.trim?.() ?? value]),
    ) as EditableProfile;
    const token = await user.getIdToken();
    const response = await fetch("/api/profile", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cleanValues),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(payload.error ?? "Your profile could not be saved."));
    setProfile((current) => current ? { ...current, ...cleanValues, onboardingComplete: true } : current);
  }, [user]);

  const refreshProfile = useCallback(async () => {
    await loadProfile(user);
  }, [loadProfile, user]);

  const refreshSession = useCallback(async () => {
    if (!user) return;
    await reload(user);
    const token = await user.getIdToken(true);
    const nextIsAdmin = await loadAdminStatus(user);
    setIsAdmin(nextIsAdmin);
    if (user.emailVerified && !nextIsAdmin) {
      const response = await fetch("/api/auth/sync-email-verification", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload.error ?? "Email verification could not be synchronized."));
      }
    }
    if (nextIsAdmin) setProfile(null);
    else await loadProfile(user);
    setUser(user);
  }, [loadAdminStatus, loadProfile, user]);

  const sendAccountVerificationEmail = useCallback(async () => {
    if (!user) throw new Error("Log in before requesting a verification email.");
    if (user.emailVerified) return;
    await sendEmailVerification(user);
  }, [user]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    profile,
    isAdmin,
    loading,
    configurationError,
    signUp,
    signUpAdmin,
    logIn,
    logOut,
    saveProfile,
    refreshProfile,
    refreshSession,
    sendAccountVerificationEmail,
  }), [configurationError, isAdmin, loading, logIn, logOut, profile, refreshProfile, refreshSession, saveProfile, sendAccountVerificationEmail, signUp, signUpAdmin, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
