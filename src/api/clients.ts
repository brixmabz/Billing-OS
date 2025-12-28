/**
 * Clients API Service
 * Handles client (healthcare provider) management
 */

import httpClient from './client';
import type { PaginatedResponse } from './client';

export interface Client {
  id: number;
  name: string;
  code: string;
  email: string;
  contact_name?: string;
  phone?: string;
  address?: string;
  sla_hours: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Stats populated from dashboard
  total_requests?: number;
  pending_requests?: number;
  avg_response_time?: number;
}

export interface CreateClientData {
  name: string;
  code: string;
  email: string;
  contact_name?: string;
  phone?: string;
  address?: string;
  sla_hours?: number;
  is_active?: boolean;
}

export interface UpdateClientData {
  name?: string;
  code?: string;
  email?: string;
  contact_name?: string;
  phone?: string;
  address?: string;
  sla_hours?: number;
  is_active?: boolean;
}

export interface ClientFilters {
  is_active?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
}

class ClientsAPI {
  /**
   * Get paginated list of clients
   */
  async getClients(filters?: ClientFilters): Promise<PaginatedResponse<Client>> {
    return httpClient.get<PaginatedResponse<Client>>('/clients', filters as Record<string, unknown>);
  }

  /**
   * Get all clients (no pagination, for dropdowns)
   */
  async getAllClients(): Promise<Client[]> {
    const response = await httpClient.get<PaginatedResponse<Client>>('/clients', { page_size: 1000 });
    return response.items;
  }

  /**
   * Get a single client by ID
   */
  async getClient(id: number): Promise<Client> {
    return httpClient.get<Client>(`/clients/${id}`);
  }

  /**
   * Create a new client
   */
  async createClient(data: CreateClientData): Promise<Client> {
    return httpClient.post<Client>('/clients', data);
  }

  /**
   * Update an existing client
   */
  async updateClient(id: number, data: UpdateClientData): Promise<Client> {
    return httpClient.put<Client>(`/clients/${id}`, data);
  }

  /**
   * Delete a client (soft delete - sets is_active to false)
   */
  async deleteClient(id: number): Promise<void> {
    return httpClient.delete<void>(`/clients/${id}`);
  }

  /**
   * Validate client email matches client ID (for send-to-client validation)
   */
  async validateClientEmail(clientId: number, email: string): Promise<{ valid: boolean; message?: string }> {
    return httpClient.post<{ valid: boolean; message?: string }>(`/clients/${clientId}/validate-email`, { email });
  }

  /**
   * Get client request statistics
   */
  async getClientStats(clientId: number): Promise<{
    total_requests: number;
    open_requests: number;
    avg_response_time_days: number;
    sla_compliance_rate: number;
  }> {
    return httpClient.get(`/clients/${clientId}/stats`);
  }
}

export const clientsAPI = new ClientsAPI();
export default clientsAPI;
