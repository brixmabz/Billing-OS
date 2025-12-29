import { useState, useEffect, useCallback } from 'react';
import Navbar from '../../components/layout/Navbar';
import SendToClientModal from '../../components/admin/SendToClientModal';
import NeedInfoModal from '../../components/admin/NeedInfoModal';
import { requestsAPI } from '../../api';
import { clientsAPI } from '../../api/clients';
import type { Client } from '../../api/clients';
import type { BillingRequestResponse, CloseRequestData, AgencyID, RequestType } from '../../api/requests';
import { useMutation } from '../../hooks/useApi';

type QueueFilter = 'all' | 'pending' | 'sent' | 'responded' | 'breach';

interface QueueRequest {
  id: string;
  numericId: number;
  client: string;
  accountNumber: string;
  type: string;
  typeIcon: string;
  typeColor: string;
  collector: { initials: string; name: string; color: string };
  status: 'pending' | 'claimed' | 'with-client' | 'responded' | 'closed' | 'breach';
  statusLabel: string;
  statusDetail?: string;
  age: string;
  isBreach?: boolean;
  balance?: string;
  notes?: string;
  createdAt?: string;
  claimedBy?: string;
  internalFileId?: string;
  requiredFieldsPayload?: Record<string, unknown>;
  timeline?: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
    user?: string;
  }>;
  slaRemaining?: string;
}

// Map request type to icon and color
const typeConfig: Record<string, { icon: string; color: string }> = {
  insurance_coverage_claim: { icon: 'fa-shield-halved', color: 'amber' },
  wrong_insurance_refile: { icon: 'fa-shield', color: 'amber' },
  auto_accident_3rd_party: { icon: 'fa-car-burst', color: 'red' },
  medicaid_medicare_question: { icon: 'fa-hospital', color: 'blue' },
  paid_direct_to_provider: { icon: 'fa-file-invoice-dollar', color: 'blue' },
  on_payment_plan: { icon: 'fa-calendar-check', color: 'violet' },
  payment_posted_wrong: { icon: 'fa-circle-xmark', color: 'red' },
  not_our_patient: { icon: 'fa-user-xmark', color: 'purple' },
  identity_theft_fraud: { icon: 'fa-user-secret', color: 'slate' },
  itemized_bill_request: { icon: 'fa-file-lines', color: 'slate' },
  validation_package_request: { icon: 'fa-file-circle-check', color: 'cyan' },
  statement_resend: { icon: 'fa-envelope', color: 'blue' },
  overcharged_balance_incorrect: { icon: 'fa-scale-balanced', color: 'red' },
  service_cancelled_not_billed: { icon: 'fa-ban', color: 'slate' },
};

// Format request type for display
const formatRequestType = (type: string): string => {
  return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

// Format field name for display (e.g., "payment_method" -> "Payment Method")
const formatFieldName = (key: string): string => {
  return key.split('_').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

// Get timeline dot color based on event type
const getTimelineDotColor = (type: string): string => {
  const colors: Record<string, string> = {
    claimed: 'bg-violet-500',
    created: 'bg-blue-500',
    sent_to_client: 'bg-emerald-500',
    client_response: 'bg-emerald-500',
    closed: 'bg-slate-500',
    need_info_requested: 'bg-amber-500',
  };
  return colors[type] || 'bg-slate-400';
};

// Calculate relative time
const getRelativeTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
};

// Get initials from name
const getInitials = (name: string): string => {
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

// Get a consistent color based on name
const getCollectorColor = (name: string): string => {
  const colors = ['slate', 'blue', 'emerald', 'amber', 'violet', 'rose'];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

// Transform API response to UI format
const transformRequest = (req: BillingRequestResponse): QueueRequest => {
  const config = typeConfig[req.request_type] || { icon: 'fa-circle-info', color: 'slate' };
  const collectorName = req.collector_name || 'Unknown';

  // Map backend status to UI status
  let uiStatus: QueueRequest['status'] = 'pending';
  let statusLabel = 'Pending';
  let statusDetail: string | undefined;

  // Check for SLA breach
  const isBreach = req.sla_breached;

  const now = new Date();

  switch (req.status) {
    case 'OPEN':
      uiStatus = 'pending';
      statusLabel = 'Pending Triage';
      break;
    case 'CLAIMED':
      uiStatus = 'claimed';
      statusLabel = 'Claimed';
      statusDetail = req.assigned_admin_name ? `by ${req.assigned_admin_name}` : undefined;
      break;
    case 'SENT':
      uiStatus = isBreach ? 'breach' : 'with-client';
      statusLabel = isBreach ? 'SLA Breach' : 'With Client';
      if (req.sent_at) {
        const sentDate = new Date(req.sent_at);
        const daysSinceSent = Math.floor((now.getTime() - sentDate.getTime()) / 86400000);
        statusDetail = isBreach ? `No response in ${daysSinceSent} days` : `Sent ${daysSinceSent}d ago`;
      }
      break;
    case 'RESPONDED':
      uiStatus = 'responded';
      statusLabel = 'Client Responded';
      statusDetail = req.resolution_code ? req.resolution_code.replace(/_/g, ' ') : undefined;
      break;
    case 'CLOSED':
      uiStatus = 'closed';
      statusLabel = 'Closed';
      statusDetail = req.resolution_code ? req.resolution_code.replace(/_/g, ' ') : undefined;
      break;
  }

  // Calculate SLA remaining
  let slaRemaining: string | undefined;
  if (req.sla_due_at) {
    const slaDue = new Date(req.sla_due_at);
    const diffMs = slaDue.getTime() - now.getTime();
    if (diffMs > 0) {
      const days = Math.floor(diffMs / 86400000);
      const hours = Math.floor((diffMs % 86400000) / 3600000);
      const mins = Math.floor((diffMs % 3600000) / 60000);

      if (days > 0) {
        slaRemaining = `${days}d ${hours}h remaining`;
      } else if (hours > 0) {
        slaRemaining = `${hours}h ${mins}m remaining`;
      } else {
        slaRemaining = `${mins}m remaining`;
      }
    } else {
      slaRemaining = 'Overdue';
    }
  }

  return {
    id: req.request_id || `REQ-${String(req.id).padStart(4, '0')}`,
    numericId: req.id,
    client: req.client_name || 'Unknown Client',
    accountNumber: req.account_reference,
    type: formatRequestType(req.request_type),
    typeIcon: config.icon,
    typeColor: config.color,
    collector: {
      initials: getInitials(collectorName),
      name: collectorName.split(' ')[0] + (collectorName.split(' ')[1] ? ` ${collectorName.split(' ')[1][0]}.` : ''),
      color: getCollectorColor(collectorName),
    },
    status: uiStatus,
    statusLabel,
    statusDetail,
    age: getRelativeTime(req.created_at),
    isBreach,
    notes: req.notes,
    createdAt: req.created_at,
    claimedBy: req.assigned_admin_name,
    internalFileId: req.internal_file_id,
    balance: (req.required_fields_payload?.balance as string) || undefined,
    requiredFieldsPayload: req.required_fields_payload,
    timeline: req.timeline,
    slaRemaining,
  };
};

export default function Queue() {
  const [activeFilter, setActiveFilter] = useState<QueueFilter>('all');
  const [requests, setRequests] = useState<QueueRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<QueueRequest | null>(null);
  const [showSlideOver, setShowSlideOver] = useState(false);
  const [toast, setToast] = useState<{ message: string; icon: string; color: string } | null>(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendingRequest, setSendingRequest] = useState<QueueRequest | null>(null);
  const [showNeedInfoModal, setShowNeedInfoModal] = useState(false);
  const [needInfoRequest, setNeedInfoRequest] = useState<QueueRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  // Dropdown filter state
  const [agencyFilter, setAgencyFilter] = useState<string>('');
  const [clientFilter, setClientFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [clients, setClients] = useState<Client[]>([]);

  // Calculate stats from requests
  const stats = {
    pending: requests.filter(r => r.status === 'pending' || r.status === 'claimed').length,
    withClient: requests.filter(r => r.status === 'with-client').length,
    breach: requests.filter(r => r.isBreach).length,
    total: totalCount,
  };

  // API mutations - use request_id (string like "REQ-0001") not numericId
  const { execute: claimRequestAPI, loading: claiming } = useMutation(
    (requestId: string) => requestsAPI.claimRequest(requestId)
  );

  const { execute: sendToClientAPI, loading: sending } = useMutation(
    (args: { requestId: string; data?: { recipient_email?: string; cc_email?: string } }) =>
      requestsAPI.sendToClient(args.requestId, args.data)
  );

  const { execute: closeRequestAPI, loading: closing } = useMutation(
    (data: { requestId: string; closeData: CloseRequestData }) => requestsAPI.closeRequest(data.requestId, data.closeData)
  );

  const { execute: needInfoAPI, loading: requestingInfo } = useMutation(
    (data: { requestId: string; reason: string; message?: string }) => requestsAPI.needInfo(data.requestId, { reason: data.reason, message: data.message })
  );

  // Fetch requests from API
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await requestsAPI.getRequests({
        page: currentPage,
        page_size: 50,
        ...(agencyFilter && { agency_id: agencyFilter as AgencyID }),
        ...(clientFilter && { client_id: parseInt(clientFilter) }),
        ...(typeFilter && { request_type: typeFilter as RequestType }),
      });
      const transformed = response.items.map(transformRequest);
      setRequests(transformed);
      setTotalCount(response.total);
    } catch (err) {
      console.error('Failed to fetch requests:', err);
      setError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [currentPage, agencyFilter, clientFilter, typeFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Fetch clients for dropdown on mount
  useEffect(() => {
    clientsAPI.getAllClients().then(setClients).catch(console.error);
  }, []);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [agencyFilter, clientFilter, typeFilter]);

  const filteredRequests = requests.filter((req) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'pending') return req.status === 'pending' || req.status === 'claimed';
    if (activeFilter === 'sent') return req.status === 'with-client';
    if (activeFilter === 'responded') return req.status === 'responded';
    if (activeFilter === 'breach') return req.isBreach;
    return true;
  });

  const showToast = (message: string, icon: string, color: string) => {
    setToast({ message, icon, color });
    setTimeout(() => setToast(null), 3000);
  };

  const claimRequest = async (requestId: string) => {
    const result = await claimRequestAPI(requestId);
    if (result) {
      // Update local state on success
      setRequests((prev) =>
        prev.map((req) =>
          req.id === requestId
            ? { ...req, status: 'claimed' as const, statusLabel: 'Claimed', statusDetail: 'by You' }
            : req
        )
      );
      showToast('Request claimed successfully', 'fa-check-circle', 'emerald');
    } else {
      showToast('Failed to claim request', 'fa-exclamation-circle', 'red');
    }
  };

  const openSendModal = (request: QueueRequest) => {
    setSendingRequest(request);
    setShowSendModal(true);
    setShowSlideOver(false);
  };

  const handleSendToClient = async (data: { recipientEmail: string; ccEmail?: string }): Promise<boolean> => {
    if (!sendingRequest) return false;

    const result = await sendToClientAPI({
      requestId: sendingRequest.id,
      data: {
        recipient_email: data.recipientEmail,
        cc_email: data.ccEmail
      }
    });
    if (result) {
      // Update local state on success
      setRequests((prev) =>
        prev.map((req) =>
          req.id === sendingRequest.id
            ? { ...req, status: 'with-client' as const, statusLabel: 'With Client', statusDetail: 'Sent just now' }
            : req
        )
      );
      showToast('Request sent to client', 'fa-paper-plane', 'blue');
      return true;
    } else {
      showToast('Failed to send request', 'fa-exclamation-circle', 'red');
      return false;
    }
  };

  const openNeedInfoModal = (request: QueueRequest) => {
    setNeedInfoRequest(request);
    setShowNeedInfoModal(true);
    setShowSlideOver(false);
  };

  const handleNeedInfoSubmit = async (reason: string, message: string) => {
    if (!needInfoRequest) return;

    const result = await needInfoAPI({
      requestId: needInfoRequest.id,
      reason,
      message: message || undefined
    });

    if (result) {
      showToast('Info request sent to collector', 'fa-question-circle', 'amber');
      setShowNeedInfoModal(false);
      setNeedInfoRequest(null);
    } else {
      showToast('Failed to send info request', 'fa-exclamation-circle', 'red');
    }
  };

  const closeRequest = async (requestId: string) => {
    const result = await closeRequestAPI({
      requestId: requestId,
      closeData: { resolution_code: 'DEBT_VALID' }
    });
    if (result) {
      // Remove from local state on success
      setRequests((prev) => prev.filter((req) => req.id !== requestId));
      showToast('Request closed successfully', 'fa-check-circle', 'emerald');
    } else {
      showToast('Failed to close request', 'fa-exclamation-circle', 'red');
    }
  };

  const getTypeColorClasses = (color: string) => {
    const colors: Record<string, string> = {
      amber: 'bg-amber-100 text-amber-800',
      blue: 'bg-blue-100 text-blue-800',
      red: 'bg-red-100 text-red-800',
      purple: 'bg-purple-100 text-purple-800',
      slate: 'bg-slate-100 text-slate-800',
      violet: 'bg-violet-100 text-violet-800',
      cyan: 'bg-cyan-100 text-cyan-800',
      emerald: 'bg-emerald-100 text-emerald-800',
    };
    return colors[color] || colors.slate;
  };

  const getStatusClasses = (status: string) => {
    const classes: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700',
      claimed: 'bg-violet-100 text-violet-700',
      'with-client': 'bg-blue-100 text-blue-700',
      responded: 'bg-emerald-100 text-emerald-700',
      closed: 'bg-emerald-100 text-emerald-700',
      breach: 'bg-red-100 text-red-700',
    };
    return classes[status] || '';
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, string> = {
      pending: 'fa-clock',
      claimed: 'fa-user-check',
      'with-client': 'fa-clock',
      responded: 'fa-reply',
      closed: 'fa-check-circle',
      breach: 'fa-exclamation-circle',
    };
    return icons[status] || '';
  };

  const getCollectorColorClasses = (color: string) => {
    const colors: Record<string, string> = {
      slate: 'bg-slate-200 text-slate-600',
      blue: 'bg-blue-100 text-blue-600',
      emerald: 'bg-emerald-100 text-emerald-600',
      amber: 'bg-amber-100 text-amber-600',
      violet: 'bg-violet-100 text-violet-600',
      rose: 'bg-rose-100 text-rose-600',
    };
    return colors[color] || colors.slate;
  };

  // Loading state
  if (loading && requests.length === 0) {
    return (
      <div className="bg-slate-100 min-h-screen">
        <Navbar />
        <main className="px-6 py-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <i className="fas fa-spinner fa-spin text-3xl text-blue-600 mb-4"></i>
              <p className="text-slate-500">Loading requests...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Error state
  if (error && requests.length === 0) {
    return (
      <div className="bg-slate-100 min-h-screen">
        <Navbar />
        <main className="px-6 py-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <i className="fas fa-exclamation-circle text-3xl text-red-500 mb-4"></i>
              <p className="text-slate-700 font-medium">Failed to load requests</p>
              <p className="text-slate-500 text-sm mb-4">{error}</p>
              <button
                onClick={fetchRequests}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
              >
                <i className="fas fa-rotate-right mr-2"></i>Retry
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-slate-100 min-h-screen">
      <Navbar />

      <main className="px-6 py-6 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Request Queue</h1>
            <p className="text-slate-500 text-sm mt-1">
              Manage incoming billing requests from collectors
            </p>
          </div>
          <div className="mt-4 lg:mt-0 flex flex-wrap items-center gap-3">
            {/* Quick Stats */}
            <div className="flex items-center space-x-4 bg-white rounded-lg px-4 py-2 border border-slate-200">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
                <span className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-800">{stats.pending}</span> Pending
                </span>
              </div>
              <div className="w-px h-4 bg-slate-200"></div>
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                <span className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-800">{stats.withClient}</span> With
                  Client
                </span>
              </div>
              <div className="w-px h-4 bg-slate-200"></div>
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                <span className="text-sm text-slate-600">
                  <span className="font-semibold text-red-600">{stats.breach}</span> SLA Breach
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Filter Tabs */}
            <div className="flex items-center space-x-1 bg-slate-100 rounded-lg p-1">
              {[
                { key: 'all' as QueueFilter, label: 'All', count: stats.total },
                { key: 'pending' as QueueFilter, label: 'Pending', count: stats.pending, color: 'text-amber-600' },
                { key: 'sent' as QueueFilter, label: 'With Client', count: stats.withClient, color: 'text-blue-600' },
                { key: 'breach' as QueueFilter, label: 'SLA Breach', count: stats.breach, color: 'text-red-600' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeFilter === tab.key
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-600 hover:bg-white/50'
                  }`}
                >
                  {tab.label}{' '}
                  <span className={`ml-1 ${tab.color || 'text-slate-500'}`}>{tab.count}</span>
                </button>
              ))}
            </div>

            {/* Dropdowns */}
            <div className="flex flex-wrap items-center gap-3 lg:ml-auto">
              <div className="relative">
                <select
                  value={agencyFilter}
                  onChange={(e) => setAgencyFilter(e.target.value)}
                  className="appearance-none bg-white border border-slate-300 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                >
                  <option value="">All Agencies</option>
                  <option value="MSB">MSB</option>
                  <option value="ICS">ICS</option>
                  <option value="VV">VV</option>
                </select>
                <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
              </div>
              <div className="relative">
                <select
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                  className="appearance-none bg-white border border-slate-300 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                >
                  <option value="">All Clients</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
              </div>
              <div className="relative">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="appearance-none bg-white border border-slate-300 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                >
                  <option value="">All Types</option>
                  {Object.keys(typeConfig).map((type) => (
                    <option key={type} value={type}>{formatRequestType(type)}</option>
                  ))}
                </select>
                <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
              </div>
              <button
                onClick={fetchRequests}
                disabled={loading}
                className="text-slate-500 hover:text-slate-700 p-2 disabled:opacity-50"
              >
                <i className={`fas fa-rotate-right ${loading ? 'animate-spin' : ''}`}></i>
              </button>
            </div>
          </div>
        </div>

        {/* Request List */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Table Header */}
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 grid grid-cols-12 gap-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <div className="col-span-1">Request</div>
            <div className="col-span-2">Client / Account</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-2">Collector</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-1">Age</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {/* Empty state */}
          {filteredRequests.length === 0 && !loading && (
            <div className="px-5 py-12 text-center">
              <i className="fas fa-inbox text-4xl text-slate-300 mb-4"></i>
              <p className="text-slate-500">No requests found</p>
            </div>
          )}

          {/* Request Rows */}
          <div className="divide-y divide-slate-100">
            {filteredRequests.map((request) => (
              <div
                key={request.id}
                className={`group px-5 py-4 grid grid-cols-12 gap-4 items-center transition-colors ${
                  request.isBreach
                    ? 'bg-red-50/50 hover:bg-red-50'
                    : request.status === 'responded'
                    ? 'bg-emerald-50/50 hover:bg-emerald-50'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="col-span-1">
                  <span className="font-mono font-semibold text-slate-800 text-sm">
                    {request.id}
                  </span>
                </div>
                <div className="col-span-2">
                  <p className="text-slate-800 font-medium text-sm">{request.client}</p>
                  <p className="text-slate-500 text-xs font-mono">{request.accountNumber}</p>
                </div>
                <div className="col-span-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTypeColorClasses(
                      request.typeColor
                    )}`}
                  >
                    <i className={`fas ${request.typeIcon} mr-1 text-[10px]`}></i>
                    {request.type}
                  </span>
                </div>
                <div className="col-span-2">
                  <div className="flex items-center space-x-2">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center ${getCollectorColorClasses(
                        request.collector.color
                      )}`}
                    >
                      <span className="font-semibold text-xs">{request.collector.initials}</span>
                    </div>
                    <span className="text-slate-700 text-sm">{request.collector.name}</span>
                  </div>
                </div>
                <div className="col-span-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusClasses(
                      request.status
                    )}`}
                  >
                    <i className={`fas ${getStatusIcon(request.status)} mr-1`}></i>
                    {request.statusLabel}
                  </span>
                  {request.statusDetail && (
                    <p
                      className={`text-xs mt-1 ${
                        request.isBreach
                          ? 'text-red-600'
                          : request.status === 'responded'
                          ? 'text-emerald-600 font-medium'
                          : 'text-slate-500'
                      }`}
                    >
                      {request.statusDetail}
                    </p>
                  )}
                </div>
                <div className="col-span-1">
                  <span
                    className={`text-sm ${
                      request.isBreach ? 'text-red-600 font-semibold' : 'text-slate-600'
                    }`}
                  >
                    {request.age}
                  </span>
                </div>
                <div className="col-span-2 flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {request.isBreach && (
                    <button className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors">
                      <i className="fas fa-arrow-up mr-1"></i>Escalate
                    </button>
                  )}
                  {request.status === 'pending' && (
                    <button
                      onClick={() => claimRequest(request.id)}
                      disabled={claiming}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-xs font-medium transition-colors"
                    >
                      <i className={`fas ${claiming ? 'fa-spinner fa-spin' : 'fa-hand'} mr-1`}></i>Claim
                    </button>
                  )}
                  {request.status === 'claimed' && (
                    <>
                      <button
                        onClick={() => openSendModal(request)}
                        disabled={sending}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg text-xs font-medium transition-colors"
                      >
                        <i className={`fas ${sending ? 'fa-spinner fa-spin' : 'fa-paper-plane'} mr-1`}></i>Send
                      </button>
                      <button
                        onClick={() => openNeedInfoModal(request)}
                        disabled={requestingInfo}
                        className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 disabled:bg-amber-50 text-amber-700 rounded-lg text-xs font-medium transition-colors"
                      >
                        <i className={`fas ${requestingInfo ? 'fa-spinner fa-spin' : 'fa-question-circle'} mr-1`}></i>Need Info
                      </button>
                    </>
                  )}
                  {request.status === 'with-client' && (
                    <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors">
                      <i className="fas fa-bell mr-1"></i>Nudge
                    </button>
                  )}
                  {request.status === 'responded' && (
                    <button
                      onClick={() => closeRequest(request.id)}
                      disabled={closing}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg text-xs font-medium transition-colors"
                    >
                      <i className={`fas ${closing ? 'fa-spinner fa-spin' : 'fa-check'} mr-1`}></i>Close
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedRequest(request);
                      setShowSlideOver(true);
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                  >
                    <i className="fas fa-eye"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
            <p className="text-slate-500 text-sm">
              Showing <span className="font-medium text-slate-700">1-{filteredRequests.length}</span>{' '}
              of <span className="font-medium text-slate-700">{stats.total}</span> requests
            </p>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-sm hover:bg-white disabled:opacity-50"
                disabled={currentPage === 1}
              >
                <i className="fas fa-chevron-left mr-1"></i>Previous
              </button>
              <button className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium">
                {currentPage}
              </button>
              <button
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={filteredRequests.length < 50}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-sm hover:bg-white disabled:opacity-50"
              >
                Next<i className="fas fa-chevron-right ml-1"></i>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Request Detail Slide-over */}
      {showSlideOver && selectedRequest && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowSlideOver(false)}
          ></div>
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-white shadow-2xl animate-slideIn">
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">Request Details</h2>
                  <p className="text-sm text-slate-500">{selectedRequest.id}</p>
                </div>
                <button
                  onClick={() => setShowSlideOver(false)}
                  className="text-slate-400 hover:text-slate-600 p-2"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  {/* Status */}
                  <div
                    className={`border rounded-xl p-4 ${
                      selectedRequest.status === 'claimed'
                        ? 'bg-violet-50 border-violet-200'
                        : selectedRequest.isBreach
                        ? 'bg-red-50 border-red-200'
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-semibold ${
                          selectedRequest.isBreach ? 'text-red-800' : 'text-violet-800'
                        }`}
                      >
                        Status: {selectedRequest.statusLabel}
                      </span>
                      {selectedRequest.statusDetail && (
                        <span className="text-violet-600 text-sm">{selectedRequest.statusDetail}</span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center space-x-4 text-sm">
                      <span className="text-violet-700">
                        SLA: {selectedRequest.slaRemaining || 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Account Info */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                      Account Information
                    </h3>
                    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-slate-500 text-sm">Client</span>
                        <span className="text-slate-800 font-medium text-sm">
                          {selectedRequest.client}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 text-sm">Account #</span>
                        <span className="text-slate-800 font-mono text-sm">
                          {selectedRequest.accountNumber}
                        </span>
                      </div>
                      {selectedRequest.internalFileId && (
                        <div className="flex justify-between">
                          <span className="text-slate-500 text-sm">MSB File ID</span>
                          <span className="text-slate-800 font-mono text-sm">
                            {selectedRequest.internalFileId}
                          </span>
                        </div>
                      )}
                      {selectedRequest.balance && (
                        <div className="flex justify-between">
                          <span className="text-slate-500 text-sm">Balance</span>
                          <span className="text-slate-800 font-semibold text-sm">
                            ${selectedRequest.balance}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Request Details */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                      Request Details
                    </h3>
                    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-slate-500 text-sm">Type</span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTypeColorClasses(
                            selectedRequest.typeColor
                          )}`}
                        >
                          {selectedRequest.type}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 text-sm">Collector</span>
                        <span className="text-slate-800 text-sm">{selectedRequest.collector.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 text-sm">Created</span>
                        <span className="text-slate-800 text-sm">
                          {selectedRequest.createdAt ? new Date(selectedRequest.createdAt).toLocaleString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Collector Notes */}
                  {selectedRequest.notes && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                        Collector Notes
                      </h3>
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <p className="text-slate-700 text-sm">{selectedRequest.notes}</p>
                      </div>
                    </div>
                  )}

                  {/* Captured Details */}
                  {selectedRequest.requiredFieldsPayload &&
                   Object.keys(selectedRequest.requiredFieldsPayload).filter(k => k !== 'balance').length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                        Captured Details
                      </h3>
                      <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                        {Object.entries(selectedRequest.requiredFieldsPayload)
                          .filter(([key]) => key !== 'balance')
                          .map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-slate-500 text-sm">{formatFieldName(key)}</span>
                              <span className="text-slate-800 text-sm">{String(value ?? '')}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Activity Log */}
                  {selectedRequest.timeline && selectedRequest.timeline.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                        Activity Log
                      </h3>
                      <div className="space-y-3">
                        {selectedRequest.timeline.slice().reverse().map((event) => (
                          <div key={event.id} className="flex items-start space-x-3">
                            <div className={`w-2 h-2 ${getTimelineDotColor(event.type)} rounded-full mt-1.5`}></div>
                            <div>
                              <p className="text-slate-700 text-sm">
                                {event.description}
                                {event.user && <span className="font-medium"> by {event.user}</span>}
                              </p>
                              <p className="text-slate-400 text-xs">
                                {new Date(event.timestamp).toLocaleString('en-US', {
                                  month: 'short', day: 'numeric', year: 'numeric',
                                  hour: 'numeric', minute: '2-digit', hour12: true
                                })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center space-x-3">
                {/* Pending: Show Claim button */}
                {selectedRequest.status === 'pending' && (
                  <button
                    onClick={() => claimRequest(selectedRequest.id)}
                    disabled={claiming}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2.5 rounded-lg font-medium text-sm transition-colors"
                  >
                    <i className={`fas ${claiming ? 'fa-spinner fa-spin' : 'fa-hand'} mr-2`}></i>
                    Claim Request
                  </button>
                )}

                {/* Claimed: Show Send to Client + Need Info */}
                {selectedRequest.status === 'claimed' && (
                  <>
                    <button
                      onClick={() => openSendModal(selectedRequest)}
                      disabled={sending}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white py-2.5 rounded-lg font-medium text-sm transition-colors"
                    >
                      <i className="fas fa-paper-plane mr-2"></i>Send to Client
                    </button>
                    <button
                      onClick={() => openNeedInfoModal(selectedRequest)}
                      disabled={requestingInfo}
                      className="px-4 py-2.5 bg-amber-100 hover:bg-amber-200 disabled:bg-amber-50 text-amber-700 rounded-lg font-medium text-sm transition-colors"
                    >
                      <i className={`fas ${requestingInfo ? 'fa-spinner fa-spin' : 'fa-question-circle'} mr-1`}></i>Need Info
                    </button>
                  </>
                )}

                {/* With Client: Show status + Close option */}
                {selectedRequest.status === 'with-client' && (
                  <>
                    <div className="flex-1 text-sm text-slate-600">
                      <i className="fas fa-clock mr-2 text-blue-500"></i>
                      Awaiting client response
                    </div>
                    <button
                      onClick={() => closeRequest(selectedRequest.id)}
                      disabled={closing}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-sm transition-colors"
                    >
                      <i className={`fas ${closing ? 'fa-spinner fa-spin' : 'fa-check-circle'} mr-1`}></i>Close
                    </button>
                  </>
                )}

                {/* Responded: Show Close button */}
                {selectedRequest.status === 'responded' && (
                  <button
                    onClick={() => closeRequest(selectedRequest.id)}
                    disabled={closing}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white py-2.5 rounded-lg font-medium text-sm transition-colors"
                  >
                    <i className={`fas ${closing ? 'fa-spinner fa-spin' : 'fa-check-circle'} mr-2`}></i>Close Request
                  </button>
                )}

                {/* Always show close panel button */}
                <button
                  onClick={() => setShowSlideOver(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-sm transition-colors"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send to Client Modal */}
      {sendingRequest && (
        <SendToClientModal
          isOpen={showSendModal}
          onClose={() => {
            setShowSendModal(false);
            setSendingRequest(null);
          }}
          onSend={handleSendToClient}
          request={{
            id: sendingRequest.id,
            client: sendingRequest.client,
            accountNumber: sendingRequest.accountNumber,
            type: sendingRequest.type,
            typeColor: sendingRequest.typeColor,
          }}
          loading={sending}
        />
      )}

      {/* Need Info Modal */}
      {needInfoRequest && (
        <NeedInfoModal
          isOpen={showNeedInfoModal}
          onClose={() => {
            setShowNeedInfoModal(false);
            setNeedInfoRequest(null);
          }}
          onSubmit={handleNeedInfoSubmit}
          request={{
            id: needInfoRequest.id,
            client: needInfoRequest.client,
            accountNumber: needInfoRequest.accountNumber,
            type: needInfoRequest.type,
            collectorName: needInfoRequest.collector.name,
          }}
          loading={requestingInfo}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slideIn">
          <div className="bg-slate-800 text-white px-5 py-3 rounded-xl shadow-lg flex items-center space-x-3">
            <i className={`fas ${toast.icon} text-${toast.color}-400`}></i>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slideIn { animation: slideIn 0.3s ease-out; }
      `}</style>
    </div>
  );
}
