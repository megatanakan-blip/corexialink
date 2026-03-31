export type UserRole = 'lite' | 'pro' | 'pending';

export interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    companyName: string;
    phoneNumber: string;
    role: UserRole;
    isApproved: boolean;
    createdAt: string; // ISO string
    updatedAt: string; // ISO string
}

export interface AuthState {
    user: UserProfile | null;
    loading: boolean;
    error: string | null;
}

// ----- Shared Types with COREXIA Core -----

export const MATERIAL_CATEGORIES = [
    "鋼管類", "銅管類", "ステンレス管類", "塩ビ管類", "CD・PF管類", "ダクト類", "ポリパイプ", "ボイド管", "ワンダーチューブ", "その他管",
    "鋼管継手", "銅管継手", "ステンレス継手", "排水継手", "樹脂管継手", "その他継手",
    "フランジ・パッキン", "バルブ", "支持金物", "アンカー・ボルト",
    "保温材", "シール材", "空調部材", "排気筒関連", "衛生器具", "計器類", "機器類", "工具", "建材", "消耗品・雑材"
] as const;

export type Category = typeof MATERIAL_CATEGORIES[number];

export interface MaterialItem {
    id: string;
    category: string;
    name: string;
    manufacturer?: string;
    model: string;
    dimensions: string;
    size?: string;
    quantity: number;
    unit: string;
    location: string;
    notes?: string;
    listPrice: number;
    sellingPrice: number;
    costPrice: number; // 仕入値
    previousListPrice?: number; // 旧定価
    previousCostPrice?: number; // 旧仕入値
    priceUpdatedDate?: string; // 価格改定日
    sourceUrl?: string;
    updatedAt: number;
}

export type SlipType = 'outbound' | 'provisional' | 'delivery' | 'invoice' | 'return' | 'reslip' | 'cover';

export interface SlipItem extends MaterialItem {
    quantity: number;
    deliveredQuantity?: number;
    appliedPrice: number;
    date?: string;
    sourceSlipNo?: string;
}

export type DeliveryTime = 'morning_first' | 'am' | 'afternoon_first' | 'pm' | 'none';
export type DeliveryDestination = 'site' | 'factory' | 'office' | 'home' | 'bring' | 'carrier' | 'none';

export interface Slip {
    id: string;
    groupId?: string;
    slipNumber?: string;
    createdAt: number;
    date: string;
    customerName: string;
    constructionName?: string;
    type: SlipType;
    items: SlipItem[];
    totalAmount: number;
    taxAmount: number;
    grandTotal: number;
    note?: string;
    deliveryTime: DeliveryTime;
    deliveryDestination: DeliveryDestination;
    isClosed?: boolean;
    siteSummaries?: { name: string; total: number }[];
    orderingPerson?: string; // Display name or UID depends on internal mapping
    orderingPersonId?: string; // Always UID for internal filtering
    orderingPersonName?: string; // Display name of the orderer
    orderingCompanyName?: string; // Company name of the orderer
    receivingPerson?: string;
    issuerPerson?: string;
    isHandled?: boolean;
    siteId?: string; // Link to Genba
    source?: 'link' | 'core';
}

export interface GenbaMember {
    uid: string;
    displayName: string;
    role: 'admin' | 'member'; // Admin can remove members
    joinedAt: number;
}

export interface Genba {
    id: string;
    name: string; // Site Name
    address?: string;
    generalContractor?: string; // 元請け会社名
    inviteCode: string; // 6-digit code for joining
    jobId?: string; // Optional link to Core's Job/Matter
    members: GenbaMember[];
    memberIds?: string[]; // For array-contains queries
    createdBy: string;
    createdAt: number;
    updatedAt: number;
    foremanMessage?: string; // "职長さんのひと言" - Site creator's greeting
}
