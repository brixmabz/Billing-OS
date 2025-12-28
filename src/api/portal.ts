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
  agency_name: string;
  service_date?: string;
  details: Record<string, unknown>;
  created_at: string;
  expires_at: string;
  has_responded: boolean;
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
    return this.request<PortalRequestInfo>(`/portal/${token}`);
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
    return this.request<{ valid: boolean; expires_at?: string }>(`/portal/${token}/validate`);
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
