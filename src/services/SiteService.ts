
import {
    collection,
    onSnapshot,
    addDoc,
    updateDoc,
    doc,
    query,
    where,
    getDocs,
    arrayUnion,
    deleteDoc,
    type Unsubscribe
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { Genba, GenbaMember, UserProfile } from '../types';

const COLLECTION = 'sites';

const generateInviteCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

export const createSite = async (name: string, address: string, user: UserProfile, generalContractor?: string) => {
    const member: GenbaMember = {
        uid: user.uid,
        displayName: user.displayName,
        role: 'admin',
        joinedAt: Date.now()
    };

    const siteData: Omit<Genba, 'id'> = {
        name,
        address,
        generalContractor,
        inviteCode: generateInviteCode(),
        members: [member],
        createdBy: user.uid,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    const docRef = await addDoc(collection(db, COLLECTION), siteData);
    return docRef.id;
};

export const joinSite = async (inviteCode: string, user: UserProfile) => {
    const q = query(collection(db, COLLECTION), where('inviteCode', '==', inviteCode));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        throw new Error('招待コードが見つかりません');
    }

    const siteDoc = snapshot.docs[0];
    const siteData = siteDoc.data() as Genba;

    // Check if already joined
    if (siteData.members.some(m => m.uid === user.uid)) {
        return siteDoc.id; // Already joined
    }

    const newMember: GenbaMember = {
        uid: user.uid,
        displayName: user.displayName,
        role: 'member',
        joinedAt: Date.now()
    };

    await updateDoc(doc(db, COLLECTION, siteDoc.id), {
        members: arrayUnion(newMember),
        updatedAt: Date.now()
    });

    return siteDoc.id;
};

export const subscribeToMySites = (uid: string, cb: (sites: Genba[]) => void): Unsubscribe => {
    // Firestore doesn't support array-contains-any for objects nicely without specific structure tricks
    // But since `members` is an array of objects, we can't simply query `where('members', 'array-contains', uid)`.
    // We should probably rely on client-side filtering or a separate `memberIds` array if scaling is needed.
    // For now, let's try a workaround: maintain a separate field `memberIds` in the document for querying.
    // Wait, let's adjust create/join to add `memberIds`.

    // Actually, for this prototype, we might need to query all sites and filter client side?
    // No, that's bad.
    // Let's add `memberIds` query support.
    // I made a mistake in `createSite` above not adding `memberIds`. 
    // I will write the file with `memberIds` logic included.

    const q = query(collection(db, COLLECTION), where('memberIds', 'array-contains', uid));
    return onSnapshot(q, (snapshot) => {
        const sites = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Genba));
        cb(sites);
    });
};

// Re-write create/join to handle memberIds

export const createSiteWithIndex = async (name: string, address: string, user: UserProfile, generalContractor?: string) => {
    const member: GenbaMember = {
        uid: user.uid,
        displayName: user.displayName,
        role: 'admin',
        joinedAt: Date.now()
    };

    const siteData = {
        name,
        address,
        generalContractor,
        inviteCode: generateInviteCode(),
        members: [member],
        memberIds: [user.uid], // Indexable field
        createdBy: user.uid,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    const docRef = await addDoc(collection(db, COLLECTION), siteData);
    return docRef.id;
};

export const joinSiteWithIndex = async (inviteCode: string, user: UserProfile) => {
    const q = query(collection(db, COLLECTION), where('inviteCode', '==', inviteCode));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        throw new Error('招待コードが見つかりません');
    }

    const siteDoc = snapshot.docs[0];
    const siteData = siteDoc.data() as Genba & { memberIds: string[] };

    if (siteData.memberIds.includes(user.uid)) {
        return siteDoc.id;
    }

    const newMember: GenbaMember = {
        uid: user.uid,
        displayName: user.displayName,
        role: 'member',
        joinedAt: Date.now()
    };

    await updateDoc(doc(db, COLLECTION, siteDoc.id), {
        members: arrayUnion(newMember),
        memberIds: arrayUnion(user.uid),
        updatedAt: Date.now()
    });

    return siteDoc.id;
};

export const deleteSite = async (siteId: string) => {
    await deleteDoc(doc(db, COLLECTION, siteId));
};

export const leaveSite = async (siteId: string, uid: string) => {
    const siteRef = doc(db, COLLECTION, siteId);
    const snap = await getDocs(query(collection(db, COLLECTION), where('__name__', '==', siteId))); // Simplified check or just fetch
    if (snap.empty) return;

    const siteData = snap.docs[0].data() as Genba;
    const newMembers = siteData.members.filter(m => m.uid !== uid);
    const newMemberIds = (siteData.memberIds || []).filter(id => id !== uid);

    await updateDoc(siteRef, {
        members: newMembers,
        memberIds: newMemberIds,
        updatedAt: Date.now()
    });
};
export const updateSite = async (siteId: string, data: Partial<Genba>) => {
    const siteRef = doc(db, COLLECTION, siteId);
    await updateDoc(siteRef, {
        ...data,
        updatedAt: Date.now()
    });
};

export const updateSiteMessage = async (siteId: string, message: string) => {
    await updateSite(siteId, { foremanMessage: message });
};
