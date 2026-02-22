import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebaseConfig';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import type { UserProfile } from '../types';

interface AuthContextType {
    currentUser: UserProfile | null;
    firebaseUser: User | null;
    loading: boolean;
    isAdminApproved: boolean;
}

const AuthContext = createContext<AuthContextType>({
    currentUser: null,
    firebaseUser: null,
    loading: true,
    isAdminApproved: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribeProfile: (() => void) | null = null;

        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            console.log("Auth State Changed:", user ? "User logged in" : "No user", user?.uid);
            setFirebaseUser(user);

            if (user) {
                setLoading(true); // Keep loading while we set up listener
                console.log("Setting up profile listener for", user.uid);
                // Real-time listener for user profile
                unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
                    console.log("Profile snapshot:", docSnap.exists() ? "Found" : "Missing");
                    if (docSnap.exists()) {
                        const data = docSnap.data() as UserProfile;
                        console.log("Profile data loaded:", data);
                        setCurrentUser(data);
                    } else {
                        // Profile might not be created yet (race condition with Signup)
                        // or deleted. Keep currentUser null for now.
                        console.log('No profile found for user yet.');
                        setCurrentUser(null);
                    }
                    setLoading(false); // Finished loading profile (found or not)
                }, (error) => {
                    console.error('Error listening to user profile:', error);
                    setCurrentUser(null);
                    setLoading(false);
                });
            } else {
                if (unsubscribeProfile) {
                    unsubscribeProfile();
                    unsubscribeProfile = null;
                }
                setCurrentUser(null);
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeProfile) unsubscribeProfile();
        };
    }, []);

    const isAdminApproved = currentUser?.isApproved ?? false;

    return (
        <AuthContext.Provider value={{ currentUser, firebaseUser, loading, isAdminApproved }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
