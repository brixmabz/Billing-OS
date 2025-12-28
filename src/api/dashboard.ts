/**
 * Dashboard API Service
 * Handles analytics and metrics endpoints
 */

import httpClient from './client';

export interface DashboardMetrics {
  total_requests: number;
  open_requests: number;
  claimed_requests: number;
  sent_requests: number;
  responded_requests: number;
  closed_requests: number;
  sla_breach_rate: number;
  avg_time_to_claim_minutes: number;
  avg_time_to_send_hours: number;
  avg_client_response_days: number;
  requests_today: number;
  requests_this_week: number;
}

export interface CollectorStats {
  collector_id: number;
  collector_name: string;
  total_requests: number;
  open_requests: number;
  closed_requests: number;
  avg_resolution_days: number;
  sla_compliance_rate: number;
  requests_per_day: number;
  stall_ratio: number;
  false_alarm_rate: number;
  status: 'online' | 'away' | 'offline';
}

export interface ClientStats {
  client_id: number;
  client_name: string;
  total_requests: number;
  pending_requests: number;
  avg_response_days: number;
  response_rate: number;
  overdue_count: number;
  sla_score: number;
}

export interface ActivityEvent {
  id: string;
  type: 'request_created' | 'request_claimed' | 'request_sent' | 'client_responded' | 'request_closed' | 'sla_breach';
  description: string;
  request_id?: string;
  user_name?: string;
  client_name?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface RequestVolumeData {
  date: string;
  created: number;
  closed: number;
  breached: number;
}

export interface RequestTypeDistribution {
  request_type: string;
  count: number;
  percentage: number;
}

export interface SLABreachAlert {
  id: number;
  request_id: string;
  breach_type: 'unclaimed' | 'not_sent' | 'no_response';
  threshold_exceeded_by: string;
  collector_name?: string;
  client_name?: string;
  created_at: string;
}

export interface UnderEffortAlert {
  collector_id: number;
  collector_name: string;
  requests_submitted: number;
  collections_amount: number;
  days_flagged: number;
  alert_level: 'warning' | 'critical';
}

class DashboardAPI {
  /**
   * Get main dashboard metrics
   */
  async getMetrics(): Promise<DashboardMetrics> {
    return httpClient.get<DashboardMetrics>('/dashboard/metrics');
  }

  /**
   * Get collector performance statistics
   */
  async getCollectorStats(): Promise<CollectorStats[]> {
    return httpClient.get<CollectorStats[]>('/dashboard/collector-stats');
  }

  /**
   * Get client responsiveness statistics
   */
  async getClientStats(): Promise<ClientStats[]> {
    return httpClient.get<ClientStats[]>('/dashboard/client-stats');
  }

  /**
   * Get recent activity feed
   */
  async getRecentActivity(limit?: number): Promise<ActivityEvent[]> {
    return httpClient.get<ActivityEvent[]>('/dashboard/activity', { limit: limit || 20 });
  }

  /**
   * Get request volume over time (for charts)
   */
  async getRequestVolume(days?: number): Promise<RequestVolumeData[]> {
    return httpClient.get<RequestVolumeData[]>('/dashboard/request-volume', { days: days || 30 });
  }

  /**
   * Get request type distribution
   */
  async getRequestTypeDistribution(): Promise<RequestTypeDistribution[]> {
    return httpClient.get<RequestTypeDistribution[]>('/dashboard/request-types');
  }

  /**
   * Get active SLA breach alerts
   */
  async getSLABreachAlerts(): Promise<SLABreachAlert[]> {
    return httpClient.get<SLABreachAlert[]>('/dashboard/sla-breaches');
  }

  /**
   * Get under-effort collector alerts
   */
  async getUnderEffortAlerts(): Promise<UnderEffortAlert[]> {
    return httpClient.get<UnderEffortAlert[]>('/dashboard/under-effort-alerts');
  }

  /**
   * Get stats for a specific collector
   */
  async getCollectorDetail(collectorId: number): Promise<CollectorStats> {
    return httpClient.get<CollectorStats>(`/dashboard/collectors/${collectorId}`);
  }

  /**
   * Get stats for a specific client
   */
  async getClientDetail(clientId: number): Promise<ClientStats> {
    return httpClient.get<ClientStats>(`/dashboard/clients/${clientId}`);
  }
}

export const dashboardAPI = new DashboardAPI();
export default dashboardAPI;
