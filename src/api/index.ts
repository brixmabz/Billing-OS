/**
 * API Module Exports
 * Central export point for all API services
 */

// HTTP Client
export { httpClient, type ApiError, type PaginatedResponse } from './client';

// Auth API
export { authAPI } from './auth';

// Requests API
export {
  requestsAPI,
  type AgencyID,
  type RequestType,
  type RequestStatus,
  type Priority,
  type ResolutionCode,
  type TimelineEvent,
  type Attachment,
  type BillingRequestResponse,
  type CreateRequestData,
  type UpdateRequestData,
  type RequestFilters,
  type SendToClientData,
  type CloseRequestData,
  type DedupeCheckResponse,
} from './requests';

// Dashboard API
export {
  dashboardAPI,
  type DashboardMetrics,
  type CollectorStats,
  type ClientStats,
  type ActivityEvent,
  type RequestVolumeData,
  type RequestTypeDistribution,
  type SLABreachAlert,
  type UnderEffortAlert,
} from './dashboard';

// Clients API
export {
  clientsAPI,
  type Client,
  type CreateClientData,
  type UpdateClientData,
  type ClientFilters,
} from './clients';

// Portal API
export {
  portalAPI,
  type PortalRequestInfo,
  type PortalResponseData,
  type PortalUploadResponse,
  type PortalSubmitResponse,
} from './portal';

// Users API
export {
  usersAPI,
  type UserRole,
  type User,
  type CreateUserData,
  type UpdateUserData,
  type ChangePasswordData,
  type UserFilters,
} from './users';
