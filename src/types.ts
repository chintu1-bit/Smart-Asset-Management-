export type UserRole = "ADMIN" | "USER";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export type AssetStatus = "HEALTHY" | "MAINTENANCE" | "RETIRED";

export interface Asset {
  id: string;
  name: string;
  category: string;
  description: string;
  totalQuantity: number;
  availableQuantity: number; // calculated real-time or stored
  status: AssetStatus;
  condition: string;
  qrCode?: string; // QR code representation data/string
  lastMaintained?: string;
}

export type BookingStatus = "PENDING" | "APPROVED" | "REJECTED" | "ISSUED" | "RETURNED";
export type ReturnCondition = "EXCELLENT" | "DAMAGED" | "UNKNOWN";

export interface Booking {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  assetId: string;
  assetName: string;
  assetCategory: string;
  quantity: number;
  startDate: string; // ISO String or YYYY-MM-DD
  endDate: string; // ISO String or YYYY-MM-DD
  status: BookingStatus;
  returnStatus?: ReturnCondition;
  returnedAt?: string;
  notes?: string;
  createdAt: string;
}

export interface MaintenanceLog {
  id: string;
  assetId: string;
  assetName: string;
  issueDescription: string;
  reportedBy: string;
  reportedAt: string;
  resolvedAt?: string;
  status: "OPEN" | "RESOLVED";
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string; // e.g., "CREATE_ASSET", "APPROVE_BOOKING", "RETURN_ASSET"
  targetName: string; // descriptive target target
  timestamp: string;
  details: string;
}

export interface SystemStats {
  totalAssets: number;
  activeBookings: number;
  pendingApprovals: number;
  overdueCount: number;
  categoryDistribution: { name: string; value: number }[];
  assetUtilization: { name: string; utilization: number }[];
  recentAuditLogs: AuditLog[];
}
