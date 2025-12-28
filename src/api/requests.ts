/**
 * Requests API Service
 * Handles all billing request operations
 */

import httpClient from './client';
import type { PaginatedResponse } from './client';

// Types matching backend schemas
export type AgencyID = 'ICS' | 'MSB' | 'VV';

export type RequestType =
  | 'insurance_coverage_claim'
  | 'wrong_insurance_refile'
  | 'auto_accident_3rd_party'
  | 'medicaid_medicare_question'
  | 'paid_direct_to_provider'
  | 'on_payment_plan'
  | 'payment_posted_wrong'
  | 'not_our_patient'
  | 'identity_theft_fraud'
  | 'itemized_bill_request'
  | 'validation_package_request'
  | 'statement_resend'
  | 'overcharged_balance_incorrect'
  | 'service_cancelled_not_billed';

export type RequestStatus = 'OPEN' | 'CLAIMED' | 'SENT' | 'RESPONDED' | 'CLOSED';

export type Priority = 'NORMAL' | 'HIGH';

export type ResolutionCode =
  | 'DEBT_VALID'
  | 'BALANCE_ADJUSTED'
  | 'INSURANCE_PAID'
  | 'PATIENT_PAID'
  | 'ACCOUNT_RECALLED'
  | 'IDENTITY_CONFIRMED_FRAUD'
  | 'NO_CLIENT_RESPONSE'
  | 'DUPLICATE_CLOSED'
  | 'OTHER';

export interface TimelineEvent {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  user?: string;
  metadata?: Record<string, unknown>;
}

export interface Attachment {
  id: number;
  filename: string;
  original_filename: string;
  mime_type: string;
  size: number;
  uploaded_by?: number;
  uploaded_by_client: boolean;
  created_at: string;
}

export interface BillingRequestResponse {
  id: number;
  request_id: string;
  agency_id: AgencyID;
  client_id: number;
  client_name?: string;
  account_reference: string;
  internal_file_id?: string;
  debtor_language: string;
  collector_id: number;
  collector_name?: string;
  assigned_admin_id?: number;
  assigned_admin_name?: string;
  request_type: RequestType;
  required_fields_payload: Record<string, unknown>;
  notes?: string;
  status: RequestStatus;
  priority: Priority;
  hold_behavior: string;
  created_at: string;
  updated_at: string;
  claimed_at?: string;
  sent_at?: string;
  responded_at?: string;
  closed_at?: string;
  sla_due_at?: string;
  sla_breached: boolean;
  resolution_code?: ResolutionCode;
  resolution_notes?: string;
  attachments: Attachment[];
  timeline: TimelineEvent[];
}

export interface CreateRequestData {
  agency_id: AgencyID;
  client_id: number;
  account_reference: string;
  internal_file_id?: string;
  debtor_language?: string;
  request_type: RequestType;
  required_fields_payload: Record<string, unknown>;
  notes?: string;
  priority?: Priority;
}

export interface UpdateRequestData {
  notes?: string;
  required_fields_payload?: Record<string, unknown>;
  priority?: Priority;
}

export interface RequestFilters {
  status?: RequestStatus;
  request_type?: RequestType;
  client_id?: number;
  collector_id?: number;
  agency_id?: AgencyID;
  sla_breached?: boolean;
  page?: number;
  page_size?: number;
  search?: string;
}

export interface SendToClientData {
  recipient_email?: string;
  message?: string;
}

export interface CloseRequestData {
  resolution_code: ResolutionCode;
  resolution_notes?: string;
}

export interface NeedInfoData {
  reason: string;
  message?: string;
}

export interface DedupeCheckResponse {
  is_duplicate: boolean;
  existing_request_id?: string;
  existing_status?: string;
}

class RequestsAPI {
  /**
   * Get paginated list of requests with optional filters
   */
  async getRequests(filters?: RequestFilters): Promise<PaginatedResponse<BillingRequestResponse>> {
    return httpClient.get<PaginatedResponse<BillingRequestResponse>>('/requests', filters as Record<string, unknown>);
  }

  /**
   * Get requests for the current collector
   * Note: The backend /requests endpoint already filters by collector role automatically
   */
  async getMyRequests(filters?: Omit<RequestFilters, 'collector_id'>): Promise<PaginatedResponse<BillingRequestResponse>> {
    return httpClient.get<PaginatedResponse<BillingRequestResponse>>('/requests', filters as Record<string, unknown>);
  }

  /**
   * Get a single request by ID
   */
  async getRequest(id: number | string): Promise<BillingRequestResponse> {
    return httpClient.get<BillingRequestResponse>(`/requests/${id}`);
  }

  /**
   * Create a new billing request
   */
  async createRequest(data: CreateRequestData): Promise<BillingRequestResponse> {
    return httpClient.post<BillingRequestResponse>('/requests', data);
  }

  /**
   * Update an existing request
   */
  async updateRequest(id: number | string, data: UpdateRequestData): Promise<BillingRequestResponse> {
    return httpClient.patch<BillingRequestResponse>(`/requests/${id}`, data);
  }

  /**
   * Claim a request (assign to current admin)
   */
  async claimRequest(id: number | string): Promise<BillingRequestResponse> {
    return httpClient.post<BillingRequestResponse>(`/requests/${id}/claim`);
  }

  /**
   * Send request to client
   */
  async sendToClient(id: number | string, data?: SendToClientData): Promise<BillingRequestResponse> {
    return httpClient.post<BillingRequestResponse>(`/requests/${id}/send`, data);
  }

  /**
   * Close a request with resolution
   */
  async closeRequest(id: number | string, data: CloseRequestData): Promise<BillingRequestResponse> {
    return httpClient.post<BillingRequestResponse>(`/requests/${id}/close`, data);
  }

  /**
   * Request more info from collector
   */
  async needInfo(id: number | string, data: NeedInfoData): Promise<BillingRequestResponse> {
    return httpClient.post<BillingRequestResponse>(`/requests/${id}/need-info`, data);
  }

  /**
   * Escalate a request
   */
  async escalateRequest(id: number | string, reason?: string): Promise<BillingRequestResponse> {
    return httpClient.post<BillingRequestResponse>(`/requests/${id}/escalate`, { reason });
  }

  /**
   * Check for duplicate requests
   */
  async checkDuplicate(account_reference: string, request_type: RequestType): Promise<DedupeCheckResponse> {
    return httpClient.post<DedupeCheckResponse>('/requests/check-duplicate', {
      account_reference,
      request_type,
    });
  }

  /**
   * Upload attachment to a request
   */
  async uploadAttachment(requestId: number | string, file: File): Promise<Attachment> {
    return httpClient.upload<Attachment>(`/requests/${requestId}/attachments`, file);
  }

  /**
   * Add a comment/note to request timeline
   */
  async addComment(id: number | string, comment: string): Promise<BillingRequestResponse> {
    return httpClient.post<BillingRequestResponse>(`/requests/${id}/comments`, { comment });
  }
}

export const requestsAPI = new RequestsAPI();
export default requestsAPI;
