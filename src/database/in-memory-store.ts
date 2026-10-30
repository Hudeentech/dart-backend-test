export interface InMemoryToken {
  identifier: string;
  code: string;
  tokenHash: string;
  type: string;
  expiresAt: Date;
  attempts: number;
}

export interface InMemoryUser {
  id: string;
  email: string | null;
  phoneNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  gender?: string | null;
  profileImageUrl: string | null;
  role: string;
  status: string;
  isProfileComplete: boolean;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  walletAccount?: {
    id: string;
    balance: number;
    currency: string;
  };
  savedAddresses?: any[];
  riderProfile?: any;
  identityProfile?: any;
}

export interface InMemoryNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string; // "ORDER_UPDATE", "PAYMENT", "SYSTEM"
  data?: any;
  isRead: boolean;
  createdAt: Date;
}

export interface InMemoryChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  clientMessageId?: string;
  senderRole: 'user' | 'other' | 'rider' | 'customer';
  type: 'text' | 'audio' | 'image' | 'file';
  text?: string;
  audioUrl?: string;
  audioDuration?: number;
  imageUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileUrl?: string;
  reactions?: string[];
  isPinned?: boolean;
  isEdited?: boolean;
  createdAt: Date;
}

export interface InMemoryConversation {
  id: string;
  userId: string;
  contactId: string;
  name: string;
  avatar: string;
  role: string;
  rating: string;
  online: boolean;
  category: 'Conversation' | 'Updates' | 'Supports';
  package?: {
    title: string;
    trackingId: string;
    icon: string;
  };
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount: number;
}

export interface InMemoryInboundPackage {
  id: string;
  userId: string;
  trackingId: string;
  title: string;
  store?: string;
  category: string;
  courier: string;
  shippedDate: string;
  estimatedArrival: string;
  fromLocation: string;
  toLocation: string;
  status: 'In-Transit' | 'Pending' | 'Delivered' | 'Ready for pickup' | 'Cancelled';
  isArrived?: boolean;
  arrivedDate?: string;
  pickupTerminal?: string;
  fragileNote?: string;
  tracks?: any[];
  payUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InMemoryPackageDraft {
  id: string;
  userId: string;
  data: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Resilient In-Memory Data Store
 * Provides instantaneous local testing and development support
 * when PostgreSQL or external services are offline or credentials are being configured.
 */
export class InMemoryStore {
  private static instance: InMemoryStore;
  public tokens = new Map<string, InMemoryToken>();
  public users = new Map<string, InMemoryUser>();
  public notifications = new Map<string, InMemoryNotification[]>();
  public conversations = new Map<string, InMemoryConversation[]>();
  public messages = new Map<string, InMemoryChatMessage[]>(); // key: chatId
  public inboundPackages = new Map<string, InMemoryInboundPackage[]>(); // key: userId
  public packageDrafts = new Map<string, InMemoryPackageDraft[]>(); // key: userId

  private constructor() {}

  public static getInstance(): InMemoryStore {
    if (!InMemoryStore.instance) {
      InMemoryStore.instance = new InMemoryStore();
    }
    return InMemoryStore.instance;
  }
}
