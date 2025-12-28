// User & Auth Types
export type UserRole = 'collector' | 'admin' | 'supervisor';

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: UserRole;
  team?: string;
  avatar?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken?: string;
}

// Request Types
export type RequestType =
  | 'itemized_statement'
  | 'validation_notice'
  | 'payment_history'
  | 'balance_verification'
  | 'pif_letter'
  | 'sif_letter'
  | 'payment_plan'
  | 'dispute_response'
  | 'cease_desist'
  | 'other';

export type RequestStatus =
  | 'pending'
  | 'in_progress'
  | 'with_client'
  | 'responded'
  | 'closed'
  | 'escalated';

export type RequestPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface BillingRequest {
  id: string;
  referenceNumber: string;
  type: RequestType;
  status: RequestStatus;
  priority: RequestPriority;

  // Debtor info
  debtorName: string;
  accountNumber: string;
  clientName: string;

  // Request details
  notes?: string;
  attachments?: Attachment[];

  // Tracking
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  slaBreached: boolean;

  // Assignment
  createdBy: string;
  assignedTo?: string;

  // Timeline
  timeline?: TimelineEvent[];
}

export interface Attachment {
  id: string;
  filename: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

export interface TimelineEvent {
  id: string;
  type: 'created' | 'status_change' | 'assigned' | 'comment' | 'attachment' | 'sent_to_client' | 'client_response';
  description: string;
  timestamp: string;
  user?: string;
  metadata?: Record<string, unknown>;
}

// Client Portal Types
export interface ClientPortalSession {
  token: string;
  requestId: string;
  expiresAt: string;
  isValid: boolean;
}

export interface ClientResponse {
  resolution: 'documents_provided' | 'need_more_time' | 'dispute' | 'other';
  notes?: string;
  attachments?: File[];
}

// Dashboard Analytics Types
export interface DashboardStats {
  totalRequests: number;
  pendingRequests: number;
  withClientRequests: number;
  respondedRequests: number;
  closedRequests: number;
  slaBreachCount: number;
  averageResolutionTime: number;
}

export interface CollectorPerformance {
  collectorId: string;
  collectorName: string;
  totalRequests: number;
  closedRequests: number;
  avgResolutionTime: number;
  slaCompliance: number;
  status: 'online' | 'away' | 'offline';
}

export interface ClientRanking {
  clientId: string;
  clientName: string;
  responseRate: number;
  avgResponseTime: number;
  totalRequests: number;
}

// Settings Types
export interface ClientConfig {
  id: string;
  name: string;
  code: string;
  email: string;
  contactName: string;
  slaHours: number;
  isActive: boolean;
}

export interface SLAConfig {
  requestType: RequestType;
  warningHours: number;
  breachHours: number;
}

// Component Props Types
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  children: React.ReactNode;
}
