import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import { requestsAPI, type BillingRequestResponse, type RequestStatus, type RequestType } from '../../api';

type StatusFilter = 'all' | 'pending' | 'with-client' | 'responded' | 'closed';

// Map backend status to UI status filter
const statusMap: Record<RequestStatus, StatusFilter> = {
  'OPEN': 'pending',
  'CLAIMED': 'pending',
  'SENT': 'with-client',
  'RESPONDED': 'responded',
  'CLOSED': 'closed',
};

// Map request type to color
const typeColorMap: Record<string, string> = {
  'insurance_coverage_claim': 'amber',
  'wrong_insurance_refile': 'amber',
  'auto_accident_3rd_party': 'amber',
  'medicaid_medicare_question': 'amber',
  'paid_direct_to_provider': 'blue',
  'on_payment_plan': 'blue',
  'payment_posted_wrong': 'blue',
  'not_our_patient': 'purple',
  'identity_theft_fraud': 'purple',
  'itemized_bill_request': 'slate',
  'validation_package_request': 'slate',
  'statement_resend': 'slate',
  'overcharged_balance_incorrect': 'red',
  'service_cancelled_not_billed': 'red',
};

// Format request type for display
const formatRequestType = (type: string): string => {
  return type.split('_').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

// Format relative time
const formatRelativeTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
};

// Format date for display
const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

// Format date with time
const formatDateTime = (dateStr: string): string => {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

// Format resolution code for display
const formatResolutionCode = (code: string): string => {
  return code.split('_').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
};

// Get timeline icon properties based on event type
const getTimelineIconProps = (type: string): { bg: string; icon: string; color: string } => {
  const map: Record<string, { bg: string; icon: string; color: string }> = {
    'client_response': { bg: 'bg-emerald-100', icon: 'fa-reply', color: 'text-emerald-600' },
    'sent_to_client': { bg: 'bg-blue-100', icon: 'fa-paper-plane', color: 'text-blue-600' },
    'claimed': { bg: 'bg-violet-100', icon: 'fa-user-check', color: 'text-violet-600' },
    'created': { bg: 'bg-slate-100', icon: 'fa-plus', color: 'text-slate-600' },
    'closed': { bg: 'bg-slate-100', icon: 'fa-check-circle', color: 'text-slate-600' },
  };
  return map[type] || { bg: 'bg-slate-100', icon: 'fa-circle', color: 'text-slate-400' };
};

export default function MyRequests() {
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [selectedRequest, setSelectedRequest] = useState<BillingRequestResponse | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [requests, setRequests] = useState<BillingRequestResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    withClient: 0,
    responded: 0,
    closed: 0,
  });

  // Fetch requests from API
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await requestsAPI.getMyRequests({
        page_size: 100,
        ...(typeFilter && { request_type: typeFilter as RequestType }),
      });
      setRequests(response.items);

      // Calculate stats
      const newStats = {
        total: response.items.length,
        pending: response.items.filter(r => r.status === 'OPEN' || r.status === 'CLAIMED').length,
        withClient: response.items.filter(r => r.status === 'SENT').length,
        responded: response.items.filter(r => r.status === 'RESPONDED').length,
        closed: response.items.filter(r => r.status === 'CLOSED').length,
      };
      setStats(newStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Filter requests based on active filter and search
  const filteredRequests = requests.filter((req) => {
    const uiStatus = statusMap[req.status];
    const matchesFilter = activeFilter === 'all' || uiStatus === activeFilter;
    const matchesSearch =
      searchQuery === '' ||
      req.account_reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.request_id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getTypeColorClasses = (type: string) => {
    const color = typeColorMap[type] || 'slate';
    const colors: Record<string, string> = {
      amber: 'bg-amber-100 text-amber-800',
      purple: 'bg-purple-100 text-purple-800',
      blue: 'bg-blue-100 text-blue-800',
      red: 'bg-red-100 text-red-800',
      slate: 'bg-slate-100 text-slate-800',
    };
    return colors[color] || colors.slate;
  };

  const getStatusClasses = (status: StatusFilter) => {
    const classes: Record<StatusFilter, string> = {
      all: '',
      pending: 'bg-amber-100 text-amber-700',
      'with-client': 'bg-blue-100 text-blue-700',
      responded: 'bg-emerald-100 text-emerald-700',
      closed: 'bg-slate-100 text-slate-600',
    };
    return classes[status];
  };

  const getStatusIcon = (status: StatusFilter) => {
    const icons: Record<StatusFilter, string> = {
      all: '',
      pending: 'fa-clock',
      'with-client': 'fa-building',
      responded: 'fa-reply',
      closed: 'fa-check-circle',
    };
    return icons[status];
  };

  const getStatusLabel = (status: RequestStatus): string => {
    const labels: Record<RequestStatus, string> = {
      'OPEN': 'Pending Triage',
      'CLAIMED': 'Being Reviewed',
      'SENT': 'With Client',
      'RESPONDED': 'Client Responded',
      'CLOSED': 'Closed',
    };
    return labels[status];
  };

  const openDetailModal = (request: BillingRequestResponse) => {
    setSelectedRequest(request);
    setShowModal(true);
  };

  const closeDetailModal = () => {
    setShowModal(false);
    setSelectedRequest(null);
  };

  return (
    <div className="bg-slate-100 min-h-screen">
      <Navbar />

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Page Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">My Requests</h1>
            <p className="text-slate-500 text-sm mt-1">
              Track the status of billing requests you've submitted
            </p>
          </div>
          <Link
            to="/collector/new-request"
            className="mt-4 sm:mt-0 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center space-x-2 w-fit"
          >
            <i className="fas fa-plus"></i>
            <span>New Request</span>
          </Link>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <i className="fas fa-exclamation-circle text-red-500"></i>
              <span className="text-red-700">{error}</span>
            </div>
            <button onClick={fetchRequests} className="text-red-600 hover:text-red-800 font-medium text-sm">
              Retry
            </button>
          </div>
        )}

        {/* Status Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
                <p className="text-slate-500 text-xs mt-1">Total Submitted</p>
              </div>
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-paper-plane text-slate-500"></i>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                <p className="text-slate-500 text-xs mt-1">Pending Triage</p>
              </div>
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-clock text-amber-600"></i>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-blue-600">{stats.withClient}</p>
                <p className="text-slate-500 text-xs mt-1">With Client</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-building text-blue-600"></i>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-emerald-600">{stats.responded}</p>
                <p className="text-slate-500 text-xs mt-1">Client Responded</p>
              </div>
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-reply text-emerald-600"></i>
              </div>
            </div>
            {stats.responded > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></span>
            )}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-slate-600">{stats.closed}</p>
                <p className="text-slate-500 text-xs mt-1">Closed</p>
              </div>
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-check-circle text-slate-500"></i>
              </div>
            </div>
          </div>
        </div>

        {/* Action Required Alert */}
        {stats.responded > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                <i className="fas fa-bell text-emerald-600 text-lg"></i>
              </div>
              <div>
                <p className="text-emerald-800 font-semibold">
                  {stats.responded} Requests Ready for Follow-Up
                </p>
                <p className="text-emerald-700 text-sm">
                  Clients have responded. Resume collection on these accounts.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveFilter('responded')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              View Now
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Status Filter Tabs */}
            <div className="flex items-center space-x-1 bg-slate-100 rounded-lg p-1">
              {[
                { key: 'all' as StatusFilter, label: 'All', count: stats.total },
                { key: 'pending' as StatusFilter, label: 'Pending', count: stats.pending, color: 'text-amber-600' },
                { key: 'with-client' as StatusFilter, label: 'With Client', count: stats.withClient, color: 'text-blue-600' },
                { key: 'responded' as StatusFilter, label: 'Responded', count: stats.responded, color: 'text-emerald-600' },
                { key: 'closed' as StatusFilter, label: 'Closed', count: stats.closed, color: 'text-slate-500' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
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

            {/* Search & Filters */}
            <div className="flex flex-wrap items-center gap-3 lg:ml-auto">
              <div className="relative">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="appearance-none bg-white border border-slate-300 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                >
                  <option value="">All Types</option>
                  {Object.keys(typeColorMap).map((type) => (
                    <option key={type} value={type}>{formatRequestType(type)}</option>
                  ))}
                </select>
                <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
              </div>
              <div className="relative">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                <input
                  type="text"
                  placeholder="Search by account #..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                />
              </div>
              <button
                onClick={fetchRequests}
                className="p-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
                title="Refresh"
              >
                <i className={`fas fa-refresh ${loading ? 'fa-spin' : ''}`}></i>
              </button>
            </div>
          </div>
        </div>

        {/* Request List */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <i className="fas fa-spinner fa-spin text-2xl text-slate-400 mb-3"></i>
              <p className="text-slate-500">Loading requests...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-12 text-center">
              <i className="fas fa-inbox text-4xl text-slate-300 mb-3"></i>
              <p className="text-slate-500">No requests found</p>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">
                      Request
                    </th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                      Client / Account
                    </th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                      Type
                    </th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                      Status
                    </th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                      Last Update
                    </th>
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRequests.map((request) => {
                    const uiStatus = statusMap[request.status];
                    const isActionRequired = request.status === 'RESPONDED';

                    return (
                      <tr
                        key={request.id}
                        className={`transition-colors ${
                          isActionRequired
                            ? 'bg-emerald-50/50 hover:bg-emerald-50'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center space-x-2">
                            {isActionRequired && (
                              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                            )}
                            <span className="font-mono font-semibold text-slate-800 text-sm">
                              {request.request_id}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-slate-800 font-medium text-sm">{request.client_name || 'Unknown Client'}</p>
                          <p className="text-slate-500 text-xs font-mono">{request.account_reference}</p>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTypeColorClasses(
                              request.request_type
                            )}`}
                          >
                            {formatRequestType(request.request_type)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div>
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusClasses(
                                uiStatus
                              )}`}
                            >
                              <i className={`fas ${getStatusIcon(uiStatus)} mr-1`}></i>
                              {getStatusLabel(request.status)}
                            </span>
                            {request.resolution_code && (
                              <p className="text-xs mt-1 font-medium text-emerald-600">
                                {request.resolution_code.replace(/_/g, ' ')}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-slate-700 text-sm">{formatRelativeTime(request.updated_at)}</p>
                          <p className="text-slate-400 text-xs">{formatDate(request.updated_at)}</p>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {isActionRequired ? (
                            <button
                              onClick={() => openDetailModal(request)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                            >
                              <i className="fas fa-phone mr-1"></i>Resume Call
                            </button>
                          ) : (
                            <button
                              onClick={() => openDetailModal(request)}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              View Details
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
                <p className="text-slate-500 text-sm">
                  Showing <span className="font-medium text-slate-700">{filteredRequests.length}</span>{' '}
                  of <span className="font-medium text-slate-700">{stats.total}</span> requests
                </p>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Request Detail Modal */}
      {showModal && selectedRequest && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeDetailModal}
          ></div>
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-white shadow-2xl overflow-y-auto animate-slideIn">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Request Details</h2>
                <p className="text-sm text-slate-500">{selectedRequest.request_id}</p>
              </div>
              <button
                onClick={closeDetailModal}
                className="text-slate-400 hover:text-slate-600 p-2"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Status Banner */}
              {selectedRequest.status === 'RESPONDED' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                      <i className="fas fa-reply text-emerald-600"></i>
                    </div>
                    <div>
                      <p className="text-emerald-800 font-semibold">Client Responded</p>
                      <p className="text-emerald-700 text-sm">
                        {selectedRequest.resolution_code
                          ? formatResolutionCode(selectedRequest.resolution_code)
                          : 'Awaiting review'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Account Info */}
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Account Information
                </h3>
                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-500 text-sm">Client</span>
                    <span className="text-slate-800 font-medium text-sm">
                      {selectedRequest.client_name || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 text-sm">Account #</span>
                    <span className="text-slate-800 font-mono text-sm">
                      {selectedRequest.account_reference}
                    </span>
                  </div>
                  {(selectedRequest.required_fields_payload as Record<string, unknown>)?.balance != null && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 text-sm">Original Balance</span>
                      <span className="text-slate-800 font-semibold text-sm">
                        ${String((selectedRequest.required_fields_payload as Record<string, unknown>).balance)}
                      </span>
                    </div>
                  )}
                  {(selectedRequest.status === 'RESPONDED' || selectedRequest.status === 'CLOSED') && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 text-sm">Current Balance</span>
                      <span className="text-emerald-600 font-semibold text-sm">$0.00</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Client Response */}
              {(selectedRequest.status === 'RESPONDED' || selectedRequest.status === 'CLOSED') &&
               selectedRequest.resolution_code && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Client Response
                  </h3>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <div className="flex items-center space-x-2 mb-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-200 text-emerald-800">
                        {formatResolutionCode(selectedRequest.resolution_code)}
                      </span>
                      {selectedRequest.responded_at && (
                        <span className="text-emerald-600 text-xs">
                          {formatDateTime(selectedRequest.responded_at)}
                        </span>
                      )}
                    </div>
                    {selectedRequest.resolution_notes && (
                      <p className="text-emerald-800 text-sm mb-3">{selectedRequest.resolution_notes}</p>
                    )}
                    {/* Client attachments */}
                    {selectedRequest.attachments?.filter(a => a.uploaded_by_client).length > 0 && (
                      <div className="space-y-2">
                        {selectedRequest.attachments.filter(a => a.uploaded_by_client).map(att => (
                          <div key={att.id} className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2 bg-white rounded-lg px-3 py-2 border border-emerald-200">
                              <i className="fas fa-file-pdf text-red-500"></i>
                              <span className="text-sm text-slate-700">{att.original_filename}</span>
                            </div>
                            <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                              <i className="fas fa-download mr-1"></i>Download
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Original Request */}
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Your Original Request
                </h3>
                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-500 text-sm">Request Type</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTypeColorClasses(
                        selectedRequest.request_type
                      )}`}
                    >
                      {formatRequestType(selectedRequest.request_type)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 text-sm">Submitted</span>
                    <span className="text-slate-800 text-sm">{formatDateTime(selectedRequest.created_at)}</span>
                  </div>
                  {selectedRequest.notes && (
                    <div className="pt-2 border-t border-slate-200">
                      <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">
                        Your Notes
                      </p>
                      <p className="text-slate-700 text-sm">{selectedRequest.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Timeline */}
              {selectedRequest.timeline && selectedRequest.timeline.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Timeline
                  </h3>
                  <div className="space-y-4">
                    {selectedRequest.timeline.slice().reverse().map((event) => {
                      const iconProps = getTimelineIconProps(event.type);
                      return (
                        <div key={event.id} className="flex items-start space-x-3">
                          <div className={`w-8 h-8 ${iconProps.bg} rounded-full flex items-center justify-center flex-shrink-0`}>
                            <i className={`fas ${iconProps.icon} ${iconProps.color} text-xs`}></i>
                          </div>
                          <div>
                            <p className="text-slate-700 text-sm font-medium">{event.description}</p>
                            {event.user && <p className="text-slate-500 text-xs">by {event.user}</p>}
                            <p className="text-slate-400 text-xs mt-1">{formatDateTime(event.timestamp)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4">
              <div className="flex items-center space-x-3">
                {selectedRequest.status === 'RESPONDED' && (
                  <button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-semibold text-sm transition-colors">
                    <i className="fas fa-phone mr-2"></i>Resume Collection Call
                  </button>
                )}
                <button
                  onClick={closeDetailModal}
                  className={`px-4 py-3 border border-slate-300 text-slate-700 rounded-lg font-medium text-sm hover:bg-slate-50 transition-colors ${
                    selectedRequest.status !== 'RESPONDED' ? 'flex-1' : ''
                  }`}
                >
                  Close
                </button>
              </div>
            </div>
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
