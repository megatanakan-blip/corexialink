import {
    collection,
    onSnapshot,
    addDoc,
    query,
    orderBy,
    where,
    deleteDoc,
    doc,
    type Unsubscribe
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { MaterialItem, Slip, SlipItem } from '../types';

const COLLECTIONS = {
    MATERIALS: 'materials',
    SLIPS: 'slips',
};

// Types needed for OrderService (Should match Core types)
// MaterialItem is already defined in ../types
// We need to ensure Slip and SlipItem are also defined or imported

export const subscribeToMaterials = (cb: (m: MaterialItem[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.MATERIALS), orderBy('updatedAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => {
            const docData = doc.data();
            return { id: doc.id, ...docData } as MaterialItem;
        });
        cb(data);
    }, (err) => console.error(`Sync Error [${COLLECTIONS.MATERIALS}]:`, err));
};

export const createOrder = async (
    items: SlipItem[],
    customerName: string, // 元請け会社名 (〇〇御中)
    uid: string,
    deliveryTime: string = 'none',
    deliveryDestination: string = 'site',
    siteId: string = '',
    constructionName: string = '', // 現場名
    orderingPersonName: string = '', // 下請け個人名 (表示名)
    orderingCompanyName: string = '' // 下請け会社名
) => {
    const totalAmount = items.reduce((sum, item) => sum + (item.appliedPrice * item.quantity), 0);
    const taxAmount = Math.floor(totalAmount * 0.1);

    // Generate Slip Number for LINK
    const d = new Date();
    const datePart = `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}${d.getDate().toString().padStart(2, '0')}`;
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    const slipNumber = `LINK-${datePart}-${randomPart}`;

    const now = Date.now();
    const orderData = {
        type: 'outbound',
        slipNumber: slipNumber,
        date: new Date().toISOString().split('T')[0],
        createdAt: now,
        updatedAt: now,
        customerName: customerName,
        constructionName: constructionName, // Set site name
        items: items,
        totalAmount: totalAmount,
        taxAmount: taxAmount,
        grandTotal: totalAmount + taxAmount,
        deliveryTime: deliveryTime as any,
        deliveryDestination: deliveryDestination as any,
        orderingPerson: orderingPersonName || uid, // For CORE UI visibility
        orderingPersonId: uid, // For internal filtering
        orderingPersonName: orderingPersonName,
        orderingCompanyName: orderingCompanyName,
        isHandled: false,
        isClosed: false,
        note: `COREXIA-LinkLからの注文 (注文者: ${orderingPersonName || uid})`,
        siteId: siteId,
        source: 'link'
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.SLIPS), orderData);
    return docRef.id;
};

export const subscribeToMyOrders = (uid: string, cb: (s: Slip[]) => void): Unsubscribe => {
    const q = query(
        collection(db, COLLECTIONS.SLIPS),
        where('orderingPersonId', '==', uid)
    );

    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Slip))
            .filter(slip => slip.type === 'outbound');
        // Client-side sort
        data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        cb(data);
    }, (err) => console.error("Error fetching my orders:", err));
}

export const subscribeToSiteOrders = (siteId: string, cb: (s: Slip[]) => void): Unsubscribe => {
    const q = query(
        collection(db, COLLECTIONS.SLIPS),
        where('siteId', '==', siteId)
    );

    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Slip))
            .filter(slip => slip.type === 'outbound');
        // Client-side sort
        data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        cb(data);
    }, (err) => console.error("Error fetching site orders:", err));
}

export const deleteSlip = async (id: string) => {
    await deleteDoc(doc(db, COLLECTIONS.SLIPS, id));
};

export const createEstimate = async (
    items: SlipItem[],
    customerName: string,
    uid: string,
    siteName: string = '',
    expirationDate: string = '',
    siteId: string = '',
    orderingPersonName: string = '',
    orderingCompanyName: string = ''
) => {
    const totalAmount = items.reduce((sum, item) => sum + (item.appliedPrice * item.quantity), 0);
    const taxAmount = Math.floor(totalAmount * 0.1);
    const grandTotal = totalAmount + taxAmount;

    if (!expirationDate) {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        expirationDate = d.toISOString().split('T')[0];
    }

    const estimateData = {
        date: new Date().toISOString().split('T')[0],
        createdAt: Date.now(),
        customerName: customerName,
        constructionName: siteName,
        items: items,
        totalAmount: totalAmount,
        taxAmount: taxAmount,
        grandTotal: grandTotal,
        status: 'pending',
        validUntil: expirationDate,
        deliveryTime: 'none',
        deliveryDestination: 'none',
        orderingPerson: orderingPersonName || uid,
        orderingPersonId: uid,
        orderingPersonName: orderingPersonName,
        orderingCompanyName: orderingCompanyName,
        isHandled: false,
        note: `COREXIA-LinkPからの見積作成 (作成者: ${orderingPersonName || uid})`,
        siteId: siteId // Add siteId
    };

    const docRef = await addDoc(collection(db, 'estimates'), estimateData);
    return docRef.id;
};

export const subscribeToMyEstimates = (uid: string, cb: (e: any[]) => void): Unsubscribe => {
    const q = query(
        collection(db, 'estimates'),
        where('orderingPersonId', '==', uid)
    );

    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Client-side sort
        data.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
        cb(data);
    }, (err) => console.error("Error fetching my estimates:", err));
}

export const deleteEstimate = async (id: string) => {
    await deleteDoc(doc(db, 'estimates', id));
};
