import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  signOut, 
  User,
  sendPasswordResetEmail,
  EmailAuthProvider,
  linkWithCredential,
  updatePassword,
  createUserWithEmailAndPassword,
  getAuth,
  getMultiFactorResolver,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc, query, where, getDocs, collection, limit, updateDoc, deleteDoc, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  role: string | null;
  status: string | null;
  loginWithEmail: (email: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  mfaResolver: any;
  mfaHints: any[];
  setMfaResolver: (resolver: any) => void;
  setMfaHints: (hints: any[]) => void;
  sendMfaCode: (hint: any, recaptchaVerifier: any) => Promise<string>;
  resolveMfaSignIn: (verificationId: string, code: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaResolver, setMfaResolver] = useState<any>(null);
  const [mfaHints, setMfaHints] = useState<any[]>([]);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // Role sync logic:
          // 1. Check if user is owner
          // 2. Check if user is pre-registered in 'users' collection by email
          
          const isAdminEmail = firebaseUser.email?.trim().toLowerCase() === 'faremazen3@gmail.com';
          const userEmail = firebaseUser.email?.trim().toLowerCase();
          
          // Speed up offline loading using localStorage cache
          let cachedRole: string | null = null;
          let cachedStatus: string | null = null;
          try {
            cachedRole = localStorage.getItem(`user_role_${firebaseUser.uid}`);
            cachedStatus = localStorage.getItem(`user_status_${firebaseUser.uid}`);
          } catch {}
          const isOffline = !navigator.onLine;

          if (isOffline && cachedRole && cachedStatus) {
            console.log("Loading offline cached role and status:", cachedRole, cachedStatus);
            setUser(firebaseUser);
            setRole(cachedRole);
            setStatus(cachedStatus);
            setLoading(false);
            return;
          }

          let preRegisteredDoc: any = null;
          if (userEmail) {
            try {
              const q = query(collection(db, 'users'), where('email', '==', userEmail), limit(1));
              const querySnap = await getDocs(q);
              if (!querySnap.empty) {
                preRegisteredDoc = querySnap.docs[0];
              }
            } catch (queryErr) {
              console.error("Error checking user registration:", queryErr);
              if (cachedRole && cachedStatus) {
                console.log("Falling back to cached credentials on query error");
                setUser(firebaseUser);
                setRole(cachedRole);
                setStatus(cachedStatus);
                setLoading(false);
                return;
              }
            }
          }

          const now = new Date().toISOString();
          
          if (preRegisteredDoc || isAdminEmail) {
            const userData = preRegisteredDoc?.data() || {};
            if (userData.status === 'suspended' || userData.status === 'disabled' || userData.status === 'inactive') {
              signOut(auth).catch(() => {});
              setUser(null);
              setRole(null);
              setStatus('suspended');
              setLoading(false);
              return;
            }

            const updatedRole = isAdminEmail ? 'admin' : (userData.role || 'sales');
            const userStatus = userData.status || 'active';
            
            // Save cache values to localStorage info
            try {
              localStorage.setItem(`user_role_${firebaseUser.uid}`, updatedRole);
              localStorage.setItem(`user_status_${firebaseUser.uid}`, userStatus);
            } catch {}

            // General user/admin document set and key validation in the background (no await to avoid offline hang)
            if (isAdminEmail) {
              const userDocRef = doc(db, 'users', firebaseUser.uid);
              const customDisplayName = firebaseUser.displayName || (preRegisteredDoc?.data()?.displayName) || 'Owner';
              setDoc(userDocRef, {
                email: userEmail,
                role: 'admin',
                status: 'active',
                displayName: customDisplayName,
                uid: firebaseUser.uid,
                password: '123456',
                lastLogin: now,
                updatedAt: now
              }, { merge: true }).catch(err => console.warn("Admin document sync deferred:", err));

              // Update password or link email auth to enforce '123456' in Firebase Authentication
              (async () => {
                try {
                  const credential = EmailAuthProvider.credential(userEmail!, '123456');
                  await linkWithCredential(firebaseUser, credential);
                  console.log("Successfully linked admin email/password credential!");
                } catch (linkErr: any) {
                  if (
                    linkErr.code === 'auth/credential-already-in-use' || 
                    linkErr.code === 'auth/provider-already-linked' || 
                    linkErr.code === 'auth/email-already-in-use'
                  ) {
                    try {
                      await updatePassword(firebaseUser, '123456');
                      console.log("Successfully updated admin Auth password directly to 123456");
                    } catch (updErr) {
                      console.warn("Could not direct-update admin password (recent login required):", updErr);
                    }
                  } else {
                    console.warn("Could not link credential to admin:", linkErr);
                  }
                }
              })();

              // Let's also verify pre-registered document cleanup if needed
              if (preRegisteredDoc && preRegisteredDoc.id !== firebaseUser.uid) {
                deleteDoc(preRegisteredDoc.ref).catch(() => {});
              }
            } else if (preRegisteredDoc) {
              const userData = preRegisteredDoc.data() || {};
              const userDocRef = doc(db, 'users', firebaseUser.uid);
              
              // We set the document at the real UID path without awaiting to prevent offline load locks
              setDoc(userDocRef, {
                ...userData,
                uid: firebaseUser.uid,
                lastLogin: now,
                displayName: firebaseUser.displayName || userData.displayName || '',
                email: userEmail
              }, { merge: true }).catch(err => console.warn("User document sync deferred:", err));

              // If the old pre-registered document ID wasn't the UID, delete it to prevent duplicates
              if (preRegisteredDoc.id !== firebaseUser.uid) {
                deleteDoc(preRegisteredDoc.ref)
                  .then(() => console.log(`Successfully migrated user document ID from ${preRegisteredDoc.id} to UID ${firebaseUser.uid}`))
                  .catch(delError => console.error("Failed to delete stale user document, but migration succeeded:", delError));
              }
            }
            
            setUser(firebaseUser);
            setRole(updatedRole);
            setStatus(userStatus);
          } else {
            // User not pre-registered by admin - reject
            signOut(auth).catch(() => {});
            setUser(null);
            setRole(null);
            setStatus('unauthorized');
          }
        } else {
          setUser(null);
          setRole(null);
          setStatus(null);
        }
      } catch (err) {
        console.error("Auth state handling error:", err);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const loginWithEmail = async (email: string, password: string, remember: boolean = true) => {
    // Before signing in, we theoretically want to check if the user is allowed.
    // But we can't query Firestore for the user if we aren't signed in (usually).
    // So we sign in first, and the onAuthStateChanged will kick them out if not allowed.
    const sanitizedEmail = email.trim().toLowerCase();
    try {
      // Force selected persistence on login based on remember me checkbox
      const persistence = remember ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);

      await signInWithEmailAndPassword(auth, sanitizedEmail, password);
    } catch (err: any) {
      if (err.code === 'auth/multi-factor-auth-required') {
        const resolver = getMultiFactorResolver(auth, err);
        setMfaResolver(resolver);
        setMfaHints(resolver.hints);
        throw err;
      }
      if (sanitizedEmail === 'faremazen3@gmail.com' && password === '123456') {
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
          try {
            await createUserWithEmailAndPassword(auth, sanitizedEmail, password);
            return;
          } catch (regErr) {
            console.error("Auto-registration fallback for admin failed:", regErr);
          }
        }
      }

      // Safe fallback: check if password was updated in Firestore by admin without updating Auth.
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
        let tempApp: any = null;
        try {
          tempApp = initializeApp(firebaseConfig, 'TempLoginVerifyApp');
          const tempDb = getFirestore(tempApp, (firebaseConfig as any).firestoreDatabaseId);
          
          const q = query(collection(tempDb, 'users'), where('email', '==', sanitizedEmail), limit(1));
          const querySnap = await getDocs(q);
          
          if (!querySnap.empty) {
            const userDoc = querySnap.docs[0];
            const userData = userDoc.data();
            
            // Compare entered password with the latest Firestore password set by Admin
            if (userData.password && userData.password === password) {
              const activeAuthPassword = userData.authPassword || userData.password;
              let signedIn = false;
              
              try {
                // Try logging in with the stored auth password
                await signInWithEmailAndPassword(auth, sanitizedEmail, activeAuthPassword);
                signedIn = true;
              } catch (signInErr: any) {
                if (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential') {
                  try {
                    // Try to create the user in Firebase Auth if not already there
                    await createUserWithEmailAndPassword(auth, sanitizedEmail, password);
                    signedIn = true;
                  } catch (createErr) {
                    console.error("Auto-creation of pre-registered user failed:", createErr);
                  }
                }
              }
              
              // Synchronize the credentials on the standard client Auth instance directly
              if (signedIn && auth.currentUser) {
                if (activeAuthPassword !== password) {
                  try {
                    await updatePassword(auth.currentUser, password);
                  } catch (updErr) {
                    console.warn("Could not direct-update auth password:", updErr);
                  }
                }
                
                // Track standard matching on future logins
                await updateDoc(doc(db, 'users', userDoc.id), {
                  authPassword: password,
                  password: password,
                  updatedAt: new Date().toISOString()
                }).catch(e => console.warn("Deferred update user doc:", e));
              }
              
              await deleteApp(tempApp);
              return; // Successfully authenticated and synchronized
            }
          }
          if (tempApp) await deleteApp(tempApp);
        } catch (syncErr) {
          console.error("Firestore password auto-sync failed:", syncErr);
          if (tempApp) {
            try { await deleteApp(tempApp); } catch (e) {}
          }
        }
      }

      throw err;
    }
  };

  const sendMfaCode = async (hint: any, recaptchaVerifier: any) => {
    if (!mfaResolver) {
      throw new Error("لا توجد جلسة مصادقة ثنائية نشطة.");
    }
    const phoneAuthProvider = new PhoneAuthProvider(auth);
    return await phoneAuthProvider.verifyPhoneNumber({
      multiFactorHint: hint,
      session: mfaResolver.session
    }, recaptchaVerifier);
  };

  const resolveMfaSignIn = async (verificationId: string, code: string) => {
    if (!mfaResolver) {
      throw new Error("لا توجد جلسة مصادقة ثنائية نشطة.");
    }
    const cred = PhoneAuthProvider.credential(verificationId, code);
    const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred);
    await mfaResolver.resolveSignIn(multiFactorAssertion);
    // Clear states on success
    setMfaResolver(null);
    setMfaHints([]);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      role, 
      status, 
      loginWithEmail, 
      logout, 
      resetPassword,
      mfaResolver,
      mfaHints,
      setMfaResolver,
      setMfaHints,
      sendMfaCode,
      resolveMfaSignIn
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
