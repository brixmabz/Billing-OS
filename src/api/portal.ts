/**
 * Portal API Service
 * Handles client portal operations (public-facing, token-based auth)
 */

import type { RequestType, ResolutionCode } from './requests';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export interface PortalRequestInfo {
  request_id: string;
  account_reference: string;
  request_type: RequestType;
  request_type_display: string;
  file_id?: string;
  balance?: string;
  details?: Record<string, unknown>;
  created_at: string;
  expires_at?: string;
  has_responded?: boolean;
  status?: string;
  client_name?: string;
}

// Backend response wrapper
interface PortalRequestResponse {
  is_valid: boolean;
  request?: {
    request_id: string;
    request_type: string;
    request_type_display: string;
    account_reference: string;
    file_id?: string;
    balance?: string;
    inquiry_details?: string;
    created_at: string;
    status: string;
  };
  client_name?: string;
  expires_at?: string;
  error?: string;
}

export interface PortalResponseData {
  resolution: ResolutionCode;
  notes?: string;
  additional_info?: Record<string, unknown>;
}

export interface PortalUploadResponse {
  id: number;
  filename: string;
  size: number;
  uploaded_at: string;
}

export interface PortalSubmitResponse {
  success: boolean;
  message: string;
  request_id: string;
}

class PortalAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || error.message || `Error: ${response.status}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  /**
   * Get request information for portal (no auth required, uses token)
   */
  async getPortalRequest(token: string): Promise<PortalRequestInfo> {
    const response = await this.request<PortalRequestResponse>(`/portal/${token}/request`);

    if (!response.is_valid || !response.request) {
      throw new Error(response.error || 'Invalid or expired token');
    }

    // Map backend response to frontend interface
    return {
      request_id: response.request.request_id,
      account_reference: response.request.account_reference,
      request_type: response.request.request_type as RequestType,
      request_type_display: response.request.request_type_display,
      file_id: response.request.file_id,
      balance: response.request.balance,
      details: response.request.inquiry_details ? { notes: response.request.inquiry_details } : undefined,
      created_at: response.request.created_at,
      status: response.request.status,
      client_name: response.client_name,
      expires_at: response.expires_at,
      has_responded: response.request.status === 'RESPONDED',
    };
  }

  /**
   * Submit client response via portal
   */
  async submitResponse(token: string, data: PortalResponseData): Promise<PortalSubmitResponse> {
    return this.request<PortalSubmitResponse>(`/portal/${token}/respond`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Upload document via portal
   */
  async uploadDocument(token: string, file: File): Promise<PortalUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseUrl}/portal/${token}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || error.message || 'Upload failed');
    }

    return response.json();
  }

  /**
   * Validate portal token
   */
  async validateToken(token: string): Promise<{ valid: boolean; expires_at?: string }> {
    return this.request<{ valid: boolean; expires_at?: string }>(`/portal/validate/${token}`);
  }

  /**
   * Get list of uploaded documents for this portal session
   */
  async getUploadedDocuments(token: string): Promise<PortalUploadResponse[]> {
    return this.request<PortalUploadResponse[]>(`/portal/${token}/documents`);
  }

  /**
   * Delete an uploaded document
   */
  async deleteDocument(token: string, documentId: number): Promise<void> {
    return this.request<void>(`/portal/${token}/documents/${documentId}`, {
      method: 'DELETE',
    });
  }
}

export const portalAPI = new PortalAPI();
export default portalAPI;
