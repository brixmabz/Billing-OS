/**
 * Users API Service
 * Handles user management operations
 */

import httpClient from './client';
import type { PaginatedResponse } from './client';

export type UserRole = 'collector' | 'admin' | 'supervisor';

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  agency_id?: string;
  team?: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  agency_id?: string;
  team?: string;
  is_active?: boolean;
}

export interface UpdateUserData {
  email?: string;
  full_name?: string;
  role?: UserRole;
  agency_id?: string;
  team?: string;
  is_active?: boolean;
}

export interface ChangePasswordData {
  current_password: string;
  new_password: string;
}

export interface UserFilters {
  role?: UserRole;
  is_active?: boolean;
  agency_id?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

class UsersAPI {
  /**
   * Get paginated list of users
   */
  async getUsers(filters?: UserFilters): Promise<PaginatedResponse<User>> {
    return httpClient.get<PaginatedResponse<User>>('/users', filters as Record<string, unknown>);
  }

  /**
   * Get all users (no pagination, for dropdowns)
   */
  async getAllUsers(role?: UserRole): Promise<User[]> {
    const filters: UserFilters = { page_size: 1000 };
    if (role) filters.role = role;
    const response = await httpClient.get<PaginatedResponse<User>>('/users', filters as Record<string, unknown>);
    return response.items;
  }

  /**
   * Get all collectors (shorthand)
   */
  async getCollectors(): Promise<User[]> {
    return this.getAllUsers('collector');
  }

  /**
   * Get all admins (shorthand)
   */
  async getAdmins(): Promise<User[]> {
    return this.getAllUsers('admin');
  }

  /**
   * Get a single user by ID
   */
  async getUser(id: number): Promise<User> {
    return httpClient.get<User>(`/users/${id}`);
  }

  /**
   * Create a new user
   */
  async createUser(data: CreateUserData): Promise<User> {
    return httpClient.post<User>('/users', data);
  }

  /**
   * Update an existing user
   */
  async updateUser(id: number, data: UpdateUserData): Promise<User> {
    return httpClient.put<User>(`/users/${id}`, data);
  }

  /**
   * Delete a user (soft delete - sets is_active to false)
   */
  async deleteUser(id: number): Promise<void> {
    return httpClient.delete<void>(`/users/${id}`);
  }

  /**
   * Change user password (admin action)
   */
  async resetPassword(id: number, newPassword: string): Promise<void> {
    return httpClient.post<void>(`/users/${id}/reset-password`, { new_password: newPassword });
  }

  /**
   * Change own password
   */
  async changePassword(data: ChangePasswordData): Promise<void> {
    return httpClient.post<void>('/users/me/change-password', data);
  }

  /**
   * Get current user profile
   */
  async getProfile(): Promise<User> {
    return httpClient.get<User>('/users/me');
  }

  /**
   * Update current user profile
   */
  async updateProfile(data: Partial<UpdateUserData>): Promise<User> {
    return httpClient.put<User>('/users/me', data);
  }
}

export const usersAPI = new UsersAPI();
export default usersAPI;
