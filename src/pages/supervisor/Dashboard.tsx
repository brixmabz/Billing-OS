import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import Navbar from '../../components/layout/Navbar';
import { dashboardAPI } from '../../api';
import type {
  DashboardMetrics,
  CollectorStats,
  ClientStats,
  ActivityEvent,
  RequestVolumeData,
  RequestTypeDistribution,
  UnderEffortAlert,
} from '../../api/dashboard';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const volumeChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 } } },
    y: { grid: { color: '#f1f5f9' }, ticks: { color: '#94a3b8', font: { size: 11 } } },
  },
};

const typeChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '65%',
  plugins: { legend: { display: false } },
};

// Helper functions
const getInitials = (name: string): string => {
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const getCollectorColor = (stats: CollectorStats): string => {
  if (stats.stall_ratio > 0.8) return 'red';
  if (stats.stall_ratio > 0.5) return 'amber';
  if (stats.sla_compliance_rate > 90) return 'emerald';
  return 'blue';
};

const getCollectorStatus = (stats: CollectorStats): string => {
  if (stats.stall_ratio > 0.8 || stats.false_alarm_rate > 0.6) return 'under-effort';
  if (stats.stall_ratio > 0.5 || stats.false_alarm_rate > 0.4) return 'watch';
  if (stats.sla_compliance_rate > 90 && stats.stall_ratio < 0.3) return 'top';
  return 'normal';
};

const getClientColor = (avgDays: number): string => {
  if (avgDays <= 1.5) return 'emerald';
  if (avgDays <= 2.5) return 'blue';
  if (avgDays <= 4) return 'amber';
  return 'red';
};

const getClientBarWidth = (avgDays: number, maxDays: number): string => {
  const percentage = Math.max(10, 100 - (avgDays / maxDays) * 80);
  return `${percentage}%`;
};

const formatRelativeTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  return `${diffDays} days ago`;
};

const getActivityIcon = (type: ActivityEvent['type']): { icon: string; color: string } => {
  switch (type) {
    case 'request_created':
      return { icon: 'fa-plus', color: 'violet' };
    case 'request_claimed':
      return { icon: 'fa-hand', color: 'blue' };
    case 'request_sent':
      return { icon: 'fa-paper-plane', color: 'blue' };
    case 'client_responded':
      return { icon: 'fa-reply', color: 'emerald' };
    case 'request_closed':
      return { icon: 'fa-check', color: 'emerald' };
    case 'sla_breach':
      return { icon: 'fa-clock', color: 'red' };
    default:
      return { icon: 'fa-circle', color: 'slate' };
  }
};

const formatRequestType = (type: string): string => {
  return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export default function Dashboard() {
  // State for API data
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [collectorStats, setCollectorStats] = useState<CollectorStats[]>([]);
  const [clientStats, setClientStats] = useState<ClientStats[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityEvent[]>([]);
  const [volumeData, setVolumeData] = useState<RequestVolumeData[]>([]);
  const [typeDistribution, setTypeDistribution] = useState<RequestTypeDistribution[]>([]);
  const [underEffortAlerts, setUnderEffortAlerts] = useState<UnderEffortAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all dashboard data
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all data in parallel
      const [
        metricsData,
        collectorsData,
        clientsData,
        activityData,
        volumeDataResult,
        typeData,
        alertsData,
      ] = await Promise.all([
        dashboardAPI.getMetrics(),
        dashboardAPI.getCollectorStats(),
        dashboardAPI.getClientStats(),
        dashboardAPI.getRecentActivity(10),
        dashboardAPI.getRequestVolume(21),
        dashboardAPI.getRequestTypeDistribution(),
        dashboardAPI.getUnderEffortAlerts(),
      ]);

      setMetrics(metricsData);
      setCollectorStats(collectorsData);
      setClientStats(clientsData);
      setRecentActivity(activityData);
      setVolumeData(volumeDataResult);
      setTypeDistribution(typeData);
      setUnderEffortAlerts(alertsData);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // Build chart data from API response
  const volumeChartData = {
    labels: volumeData.map(d => {
      const date = new Date(d.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }),
    datasets: [
      {
        label: 'Submitted',
        data: volumeData.map(d => d.created),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#3b82f6',
      },
      {
        label: 'Resolved',
        data: volumeData.map(d => d.closed),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#10b981',
      },
    ],
  };

  const typeChartData = {
    labels: typeDistribution.slice(0, 4).map(t => formatRequestType(t.request_type)),
    datasets: [
      {
        data: typeDistribution.slice(0, 4).map(t => t.percentage),
        backgroundColor: ['#3b82f6', '#f59e0b', '#10b981', '#94a3b8'],
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  };

  // Calculate max days for client ranking bar width
  const maxClientDays = Math.max(...clientStats.map(c => c.avg_response_days), 1);

  const getCollectorColorClasses = (color: string) => {
    const colors: Record<string, string> = {
      emerald: 'bg-emerald-100 text-emerald-700',
      blue: 'bg-blue-100 text-blue-700',
      amber: 'bg-amber-100 text-amber-700',
      red: 'bg-red-100 text-red-700',
    };
    return colors[color] || colors.emerald;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'top':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
            <i className="fas fa-check-circle mr-1 text-[10px]"></i>Top Performer
          </span>
        );
      case 'normal':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">Normal</span>;
      case 'watch':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            <i className="fas fa-exclamation-triangle mr-1 text-[10px]"></i>Watch
          </span>
        );
      case 'under-effort':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 animate-pulse">
            <i className="fas fa-flag mr-1 text-[10px]"></i>Under-Effort
          </span>
        );
      default:
        return null;
    }
  };

  // Loading state
  if (loading && !metrics) {
    return (
      <div className="bg-slate-100 min-h-screen">
        <Navbar showSecondaryNav={false} />
        <div className="flex items-center justify-center h-[calc(100vh-56px)]">
          <div className="text-center">
            <i className="fas fa-spinner fa-spin text-3xl text-blue-600 mb-4"></i>
            <p className="text-slate-500">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !metrics) {
    return (
      <div className="bg-slate-100 min-h-screen">
        <Navbar showSecondaryNav={false} />
        <div className="flex items-center justify-center h-[calc(100vh-56px)]">
          <div className="text-center">
            <i className="fas fa-exclamation-circle text-3xl text-red-500 mb-4"></i>
            <p className="text-slate-700 font-medium">Failed to load dashboard</p>
            <p className="text-slate-500 text-sm mb-4">{error}</p>
            <button
              onClick={fetchDashboardData}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
            >
              <i className="fas fa-rotate-right mr-2"></i>Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-100 min-h-screen">
      <Navbar showSecondaryNav={false} />

      <div className="flex pt-14">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 min-h-screen fixed left-0 top-14 bottom-0 overflow-y-auto hidden lg:block">
          <div className="p-4">
            <div className="mb-6">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Overview</p>
              <nav className="space-y-1">
                <Link to="/supervisor/dashboard" className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-slate-700 bg-blue-50 border-r-2 border-blue-600">
                  <i className="fas fa-chart-line text-blue-600 w-5"></i>
                  <span className="text-sm font-medium">Dashboard</span>
                </Link>
                <Link to="/admin/queue" className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-slate-50">
                  <i className="fas fa-inbox text-slate-400 w-5"></i>
                  <span className="text-sm">Request Queue</span>
                  <span className="ml-auto bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">47</span>
                </Link>
              </nav>
            </div>

            <div className="mb-6">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Analytics</p>
              <nav className="space-y-1">
                <a href="#" className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-slate-50">
                  <i className="fas fa-users text-slate-400 w-5"></i>
                  <span className="text-sm">Collector Performance</span>
                </a>
                <a href="#" className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-slate-50">
                  <i className="fas fa-building text-slate-400 w-5"></i>
                  <span className="text-sm">Client Response Times</span>
                </a>
                <a href="#" className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-slate-50">
                  <i className="fas fa-clock text-slate-400 w-5"></i>
                  <span className="text-sm">SLA Tracking</span>
                </a>
              </nav>
            </div>

            <div className="mb-6">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Management</p>
              <nav className="space-y-1">
                <a href="#" className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-slate-50">
                  <i className="fas fa-triangle-exclamation text-slate-400 w-5"></i>
                  <span className="text-sm">Alerts & Escalations</span>
                  <span className="ml-auto bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">3</span>
                </a>
                <a href="#" className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-slate-50">
                  <i className="fas fa-file-export text-slate-400 w-5"></i>
                  <span className="text-sm">Reports</span>
                </a>
                <Link to="/settings" className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-slate-50">
                  <i className="fas fa-gear text-slate-400 w-5"></i>
                  <span className="text-sm">Settings</span>
                </Link>
              </nav>
            </div>
          </div>

          {/* Effort Risk Rating */}
          <div className="p-4 border-t border-slate-200">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">Effort Risk Rating</span>
                <i className="fas fa-circle-info text-slate-500 text-xs"></i>
              </div>
              <div className="flex items-end space-x-2">
                <span className="text-4xl font-bold text-white">78</span>
                <span className="text-slate-500 text-sm mb-1">/ 100</span>
              </div>
              <div className="mt-3 bg-slate-700 rounded-full h-2 overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-500 to-amber-500 h-full" style={{ width: '78%' }}></div>
              </div>
              <p className="text-slate-500 text-xs mt-2">Updated 6:00 AM today</p>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-64 p-6">
          {/* Page Header */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Operations Dashboard</h1>
              <p className="text-slate-500 text-sm mt-1">Real-time billing request metrics and team performance</p>
            </div>
            <div className="mt-4 sm:mt-0 flex items-center space-x-3">
              <select className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>Today</option>
                <option>Last 7 Days</option>
                <option>Last 30 Days</option>
                <option>This Quarter</option>
              </select>
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2">
                <i className="fas fa-download text-xs"></i>
                <span>Export</span>
              </button>
            </div>
          </div>

          {/* Alert Banner */}
          {underEffortAlerts.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center animate-pulse">
                  <i className="fas fa-exclamation-triangle text-red-600"></i>
                </div>
                <div>
                  <p className="text-red-800 font-semibold text-sm">{underEffortAlerts.length} Under-Effort Alert{underEffortAlerts.length > 1 ? 's' : ''} Active</p>
                  <p className="text-red-600 text-xs">
                    {underEffortAlerts.filter(a => a.alert_level === 'critical').length} collectors flagged for high request rate + low collections
                  </p>
                </div>
              </div>
              <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">View Alerts</button>
            </div>
          )}

          {/* Top Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-500 text-sm font-medium">Open Requests</span>
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <i className="fas fa-inbox text-blue-600"></i>
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-800">{metrics?.open_requests || 0}</p>
              <div className="flex items-center mt-2 text-xs">
                <span className="text-amber-600 font-medium">{metrics?.claimed_requests || 0} claimed</span>
                <span className="text-slate-400 mx-2">•</span>
                <span className="text-slate-500">{metrics?.sent_requests || 0} with client</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-500 text-sm font-medium">SLA Breach Rate</span>
                <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                  <i className="fas fa-clock text-emerald-600"></i>
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-800">{(metrics?.sla_breach_rate || 0).toFixed(1)}%</p>
              <div className="flex items-center mt-2 text-xs">
                <i className={`fas fa-arrow-${(metrics?.sla_breach_rate || 0) < 5 ? 'down text-emerald-500' : 'up text-red-500'} mr-1`}></i>
                <span className={`${(metrics?.sla_breach_rate || 0) < 5 ? 'text-emerald-600' : 'text-red-600'} font-medium`}>
                  {(metrics?.sla_breach_rate || 0) < 5 ? 'Within target' : 'Above target'}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-500 text-sm font-medium">Avg Time to Client</span>
                <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center">
                  <i className="fas fa-paper-plane text-violet-600"></i>
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-800">
                {(metrics?.avg_time_to_send_hours || 0).toFixed(1)}<span className="text-lg text-slate-500 font-normal">hrs</span>
              </p>
              <div className="flex items-center mt-2 text-xs">
                <span className="text-slate-500">Target: &lt;4 hours</span>
                {(metrics?.avg_time_to_send_hours || 0) < 4 ? (
                  <span className="ml-2 text-emerald-600 font-medium">✓ On track</span>
                ) : (
                  <span className="ml-2 text-red-600 font-medium">⚠ Over target</span>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-500 text-sm font-medium">Avg Client Response</span>
                <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                  <i className="fas fa-reply text-amber-600"></i>
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-800">
                {(metrics?.avg_client_response_days || 0).toFixed(1)}<span className="text-lg text-slate-500 font-normal">days</span>
              </p>
              <div className="flex items-center mt-2 text-xs">
                {(metrics?.avg_client_response_days || 0) <= 2 ? (
                  <>
                    <i className="fas fa-arrow-down text-emerald-500 mr-1"></i>
                    <span className="text-emerald-600 font-medium">Good response time</span>
                  </>
                ) : (
                  <>
                    <i className="fas fa-arrow-up text-red-500 mr-1"></i>
                    <span className="text-red-600 font-medium">Slow response</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
            {/* Request Volume Chart */}
            <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-slate-800 font-semibold">Request Volume</h3>
                  <p className="text-slate-500 text-xs">Submitted vs Resolved over time</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="flex items-center text-xs text-slate-500">
                    <span className="w-3 h-3 bg-blue-500 rounded-full mr-1.5"></span>Submitted
                  </span>
                  <span className="flex items-center text-xs text-slate-500">
                    <span className="w-3 h-3 bg-emerald-500 rounded-full mr-1.5"></span>Resolved
                  </span>
                </div>
              </div>
              <div className="h-64">
                <Line data={volumeChartData} options={volumeChartOptions} />
              </div>
            </div>

            {/* Request Type Breakdown */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-slate-800 font-semibold">Request Types</h3>
                  <p className="text-slate-500 text-xs">Distribution this month</p>
                </div>
              </div>
              <div className="h-48 flex items-center justify-center">
                <Doughnut data={typeChartData} options={typeChartOptions} />
              </div>
              <div className="mt-4 space-y-2">
                {typeDistribution.slice(0, 4).map((type, index) => {
                  const colors = ['bg-blue-500', 'bg-amber-500', 'bg-emerald-500', 'bg-slate-400'];
                  return (
                    <div key={type.request_type} className="flex items-center justify-between text-sm">
                      <span className="flex items-center">
                        <span className={`w-3 h-3 ${colors[index]} rounded mr-2`}></span>
                        {formatRequestType(type.request_type)}
                      </span>
                      <span className="font-semibold text-slate-700">{type.percentage.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Collector Performance Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-slate-800 font-semibold">Collector Performance</h3>
                <p className="text-slate-500 text-xs">Ranked by Request-to-Cash efficiency</p>
              </div>
              <div className="flex items-center space-x-2">
                <input type="text" placeholder="Search collector..." className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48" />
                <button className="text-slate-500 hover:text-slate-700 p-2">
                  <i className="fas fa-filter"></i>
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Collector</th>
                    <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Requests</th>
                    <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Req/RPC</th>
                    <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Req/$1K</th>
                    <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Stall Ratio</th>
                    <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">False Alarm</th>
                    <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Req→Cash</th>
                    <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {collectorStats.map((c) => {
                    const status = getCollectorStatus(c);
                    const color = getCollectorColor(c);
                    return (
                      <tr key={c.collector_id} className={`hover:bg-slate-50 transition-colors ${status === 'under-effort' ? 'bg-red-50/50' : ''}`}>
                        <td className="px-5 py-4">
                          <div className="flex items-center space-x-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${getCollectorColorClasses(color)}`}>
                              <span className="font-semibold text-sm">{getInitials(c.collector_name)}</span>
                            </div>
                            <div>
                              <p className="text-slate-800 font-medium text-sm">{c.collector_name}</p>
                              <p className="text-slate-500 text-xs">{c.status === 'online' ? '● Online' : c.status === 'away' ? '○ Away' : '◌ Offline'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-4 text-center text-sm text-slate-700">{c.total_requests}</td>
                        <td className={`px-3 py-4 text-center text-sm ${status === 'under-effort' ? 'text-red-600 font-medium' : status === 'watch' ? 'text-amber-600 font-medium' : 'text-slate-700'}`}>{c.requests_per_day.toFixed(2)}</td>
                        <td className={`px-3 py-4 text-center text-sm ${status === 'under-effort' ? 'text-red-600 font-medium' : status === 'watch' ? 'text-amber-600 font-medium' : 'text-slate-700'}`}>{c.avg_resolution_days.toFixed(1)}</td>
                        <td className="px-3 py-4 text-center">
                          <span className={`font-semibold text-sm ${status === 'under-effort' ? 'text-red-600' : status === 'watch' ? 'text-amber-600' : status === 'top' ? 'text-emerald-700' : 'text-slate-700'}`}>{c.stall_ratio.toFixed(2)}</span>
                        </td>
                        <td className="px-3 py-4 text-center">
                          <span className={`font-semibold text-sm ${status === 'under-effort' ? 'text-red-600' : status === 'watch' ? 'text-amber-600' : status === 'top' ? 'text-emerald-700' : 'text-slate-700'}`}>{(c.false_alarm_rate * 100).toFixed(0)}%</span>
                        </td>
                        <td className="px-3 py-4 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${status === 'under-effort' ? 'bg-red-100 text-red-800' : status === 'watch' ? 'bg-amber-100 text-amber-800' : status === 'top' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>{c.sla_compliance_rate.toFixed(0)}%</span>
                        </td>
                        <td className="px-3 py-4 text-center">{getStatusBadge(status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50">
              <p className="text-slate-500 text-sm">Showing {Math.min(5, collectorStats.length)} of {collectorStats.length} collectors</p>
              <div className="flex items-center space-x-2">
                <button className="px-3 py-1 rounded border border-slate-300 text-slate-600 text-sm hover:bg-white">Previous</button>
                <button className="px-3 py-1 rounded border border-slate-300 text-slate-600 text-sm hover:bg-white">Next</button>
              </div>
            </div>
          </div>

          {/* Bottom Row: Client Response + Recent Activity */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Client Response Rankings */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200">
                <h3 className="text-slate-800 font-semibold">Client Response Rankings</h3>
                <p className="text-slate-500 text-xs">Avg days to respond (lower is better)</p>
              </div>
              <div className="divide-y divide-slate-100">
                {clientStats.slice(0, 5).map((client, index) => {
                  const color = getClientColor(client.avg_response_days);
                  const colorClasses: Record<string, { bg: string; text: string; bar: string }> = {
                    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700', bar: 'bg-emerald-500' },
                    blue: { bg: 'bg-blue-100', text: 'text-blue-700', bar: 'bg-blue-500' },
                    amber: { bg: 'bg-amber-100', text: 'text-amber-700', bar: 'bg-amber-500' },
                    red: { bg: 'bg-red-100', text: 'text-red-700', bar: 'bg-red-500' },
                  };
                  const classes = colorClasses[color];
                  return (
                    <div key={client.client_id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center space-x-3">
                        <span className={`w-6 h-6 ${classes.bg} rounded-full flex items-center justify-center ${classes.text} font-bold text-xs`}>{index + 1}</span>
                        <span className="text-slate-700 text-sm font-medium">{client.client_name}</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`${classes.text} font-semibold text-sm`}>{client.avg_response_days.toFixed(1)} days</span>
                        <div className="w-24 bg-slate-100 rounded-full h-2">
                          <div className={`${classes.bar} h-2 rounded-full`} style={{ width: getClientBarWidth(client.avg_response_days, maxClientDays) }}></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="px-5 py-3 border-t border-slate-200 bg-slate-50">
                <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">View all clients →</button>
              </div>
            </div>

            {/* Recent Activity Feed */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-slate-800 font-semibold">Recent Activity</h3>
                  <p className="text-slate-500 text-xs">Live request updates</p>
                </div>
                <span className="flex items-center text-emerald-600 text-xs font-medium">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full mr-1.5 animate-pulse"></span>Live
                </span>
              </div>
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {recentActivity.map((activity) => {
                  const { icon, color } = getActivityIcon(activity.type);
                  const colorClasses: Record<string, { bg: string; text: string }> = {
                    violet: { bg: 'bg-violet-100', text: 'text-violet-600' },
                    blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
                    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
                    red: { bg: 'bg-red-100', text: 'text-red-600' },
                    amber: { bg: 'bg-amber-100', text: 'text-amber-600' },
                    slate: { bg: 'bg-slate-100', text: 'text-slate-600' },
                  };
                  const classes = colorClasses[color] || colorClasses.slate;
                  return (
                    <div key={activity.id} className="px-5 py-3 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start space-x-3">
                        <div className={`w-8 h-8 ${classes.bg} rounded-full flex items-center justify-center flex-shrink-0 mt-0.5`}>
                          <i className={`fas ${icon} ${classes.text} text-xs`}></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-700 text-sm">
                            {activity.request_id && <span className="font-medium">{activity.request_id}</span>}
                            {' '}
                            {activity.description}
                            {activity.client_name && <span className="font-medium"> • {activity.client_name}</span>}
                          </p>
                          <p className="text-slate-500 text-xs mt-0.5">
                            {activity.user_name && `${activity.user_name} • `}
                            {formatRelativeTime(activity.timestamp)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {recentActivity.length === 0 && (
                  <div className="px-5 py-8 text-center">
                    <p className="text-slate-400 text-sm">No recent activity</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
