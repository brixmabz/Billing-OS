import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import { clientsAPI } from '../../api';
import type { Client, CreateClientData, UpdateClientData } from '../../api/clients';
import { useMutation } from '../../hooks/useApi';

type SettingsTab = 'clients' | 'import' | 'collectors' | 'sla';

// Get a consistent color based on client name
const getClientColor = (name: string): string => {
  const colors = ['blue', 'emerald', 'violet', 'amber', 'rose', 'cyan'];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

export default function Configuration() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('clients');
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [showUploadedState, setShowUploadedState] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [saving, setSaving] = useState(false);

  // Form state for client modal
  const [formData, setFormData] = useState<Partial<CreateClientData>>({
    name: '',
    code: '',
    email: '',
    sla_hours: 72,
    is_active: true,
  });

  // API mutations
  const { execute: createClient } = useMutation(
    (data: CreateClientData) => clientsAPI.createClient(data)
  );

  const { execute: updateClient } = useMutation(
    (params: { id: number; data: UpdateClientData }) => clientsAPI.updateClient(params.id, params.data)
  );

  // Fetch clients
  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const response = await clientsAPI.getClients({
        search: searchQuery || undefined,
        is_active: statusFilter === 'all' ? undefined : statusFilter === 'active',
        page_size: 100,
      });
      setClients(response.items);
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const openAddClient = () => {
    setEditingClient(null);
    setFormData({
      name: '',
      code: '',
      email: '',
      sla_hours: 72,
      is_active: true,
    });
    setShowClientModal(true);
  };

  const openEditClient = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      code: client.code,
      email: client.email,
      sla_hours: client.sla_hours,
      is_active: client.is_active,
    });
    setShowClientModal(true);
  };

  const handleSaveClient = async () => {
    if (!formData.name || !formData.code || !formData.email) return;

    setSaving(true);
    try {
      if (editingClient) {
        await updateClient({ id: editingClient.id, data: formData as UpdateClientData });
      } else {
        await createClient(formData as CreateClientData);
      }
      setShowClientModal(false);
      fetchClients();
    } catch (err) {
      console.error('Failed to save client:', err);
    } finally {
      setSaving(false);
    }
  };

  // Format SLA hours to display string
  const formatSLA = (hours: number): string => {
    const days = Math.round(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''}`;
  };

  return (
    <div className="bg-slate-100 min-h-screen">
      <Navbar showSecondaryNav={false} />

      <div className="flex pt-14">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 min-h-screen fixed left-0 top-14 bottom-0 overflow-y-auto hidden lg:block">
          <div className="p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Configuration</p>
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab('clients')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'clients' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <i className={`fas fa-building w-5 ${activeTab === 'clients' ? 'text-blue-600' : 'text-slate-400'}`}></i>
                <span className="text-sm font-medium">Client Directory</span>
              </button>
              <button
                onClick={() => setActiveTab('import')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'import' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <i className={`fas fa-file-import w-5 ${activeTab === 'import' ? 'text-blue-600' : 'text-slate-400'}`}></i>
                <span className="text-sm">Import Requests</span>
              </button>
              <button
                onClick={() => setActiveTab('collectors')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'collectors' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <i className={`fas fa-users w-5 ${activeTab === 'collectors' ? 'text-blue-600' : 'text-slate-400'}`}></i>
                <span className="text-sm">Collectors</span>
              </button>
              <button
                onClick={() => setActiveTab('sla')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'sla' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <i className={`fas fa-clock w-5 ${activeTab === 'sla' ? 'text-blue-600' : 'text-slate-400'}`}></i>
                <span className="text-sm">SLA Settings</span>
              </button>
              <Link
                to="/supervisor/dashboard"
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <i className="fas fa-arrow-left w-5 text-slate-400"></i>
                <span className="text-sm">Back to Dashboard</span>
              </Link>
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-64 p-6">
          {/* Client Directory Tab */}
          {activeTab === 'clients' && (
            <div>
              <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-800">Client Directory</h1>
                  <p className="text-slate-500 text-sm mt-1">Manage client accounts and email contacts for request routing</p>
                </div>
                <button
                  onClick={openAddClient}
                  className="mt-4 sm:mt-0 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center space-x-2"
                >
                  <i className="fas fa-plus"></i>
                  <span>Add Client</span>
                </button>
              </div>

              {/* Search & Filter */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    <input
                      type="text"
                      placeholder="Search clients..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <select className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>All Agencies</option>
                    <option>MSB</option>
                    <option>ICS</option>
                    <option>VV</option>
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                    className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <button
                    onClick={fetchClients}
                    disabled={loading}
                    className="text-slate-500 hover:text-slate-700 p-2 disabled:opacity-50"
                  >
                    <i className={`fas fa-rotate-right ${loading ? 'animate-spin' : ''}`}></i>
                  </button>
                </div>
              </div>

              {/* Client List */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Client</th>
                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Client ID</th>
                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Primary Email</th>
                        <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Contacts</th>
                        <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Response SLA</th>
                        <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
                        <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading && clients.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-12 text-center">
                            <i className="fas fa-spinner fa-spin text-2xl text-blue-600 mb-2"></i>
                            <p className="text-slate-500">Loading clients...</p>
                          </td>
                        </tr>
                      ) : clients.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-12 text-center">
                            <i className="fas fa-building text-3xl text-slate-300 mb-2"></i>
                            <p className="text-slate-500">No clients found</p>
                          </td>
                        </tr>
                      ) : (
                        clients.map((client) => {
                          const color = getClientColor(client.name);
                          const colorClasses: Record<string, { bg: string; text: string }> = {
                            blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
                            emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
                            violet: { bg: 'bg-violet-100', text: 'text-violet-600' },
                            amber: { bg: 'bg-amber-100', text: 'text-amber-600' },
                            rose: { bg: 'bg-rose-100', text: 'text-rose-600' },
                            cyan: { bg: 'bg-cyan-100', text: 'text-cyan-600' },
                          };
                          const classes = colorClasses[color] || colorClasses.blue;
                          return (
                            <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-5 py-4">
                                <div className="flex items-center space-x-3">
                                  <div className={`w-10 h-10 ${classes.bg} rounded-lg flex items-center justify-center`}>
                                    <i className={`fas fa-hospital ${classes.text}`}></i>
                                  </div>
                                  <div>
                                    <p className="text-slate-800 font-medium text-sm">{client.name}</p>
                                    <p className="text-slate-500 text-xs">Healthcare</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <span className="font-mono text-sm text-slate-700">{client.code}</span>
                              </td>
                              <td className="px-4 py-4">
                                <span className="text-sm text-slate-700">{client.email}</span>
                              </td>
                              <td className="px-4 py-4 text-center">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                                  1 email
                                </span>
                              </td>
                              <td className="px-4 py-4 text-center">
                                <span className="text-sm text-slate-700">{formatSLA(client.sla_hours)}</span>
                              </td>
                              <td className="px-4 py-4 text-center">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${client.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                  {client.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-right">
                                <button
                                  onClick={() => openEditClient(client)}
                                  className="text-blue-600 hover:text-blue-800 text-sm font-medium mr-3"
                                >
                                  Edit
                                </button>
                                <button className="text-slate-400 hover:text-slate-600 text-sm">
                                  <i className="fas fa-ellipsis-v"></i>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Import Tab */}
          {activeTab === 'import' && (
            <div>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Import Historical Requests</h1>
                <p className="text-slate-500 text-sm mt-1">
                  Upload past requests from Google Forms CSV export to migrate into the new system
                </p>
              </div>

              {/* Import Steps */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                {[
                  { step: 1, title: 'Export from Google', desc: 'Export your Google Form responses as a CSV file from the Responses tab.' },
                  { step: 2, title: 'Map Columns', desc: 'Match your CSV columns to the system fields (Client ID, Account #, Type, etc.)' },
                  { step: 3, title: 'Review & Import', desc: 'Preview the data, resolve any issues, and import into the request queue.' },
                ].map((item) => (
                  <div key={item.step} className="bg-white rounded-xl border border-slate-200 p-5">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-blue-700 font-bold">{item.step}</span>
                      </div>
                      <h3 className="font-semibold text-slate-800">{item.title}</h3>
                    </div>
                    <p className="text-slate-500 text-sm">{item.desc}</p>
                  </div>
                ))}
              </div>

              {/* Upload Area */}
              {!showUploadedState ? (
                <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
                  <h3 className="font-semibold text-slate-800 mb-4">Upload CSV File</h3>
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="fas fa-cloud-arrow-up text-slate-400 text-2xl"></i>
                    </div>
                    <p className="text-slate-700 font-medium mb-1">Drag & drop your CSV file here</p>
                    <p className="text-slate-500 text-sm mb-4">or click to browse</p>
                    <button
                      onClick={() => setShowUploadedState(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      <i className="fas fa-folder-open mr-2"></i>Select File
                    </button>
                    <p className="text-slate-400 text-xs mt-4">Supports CSV files up to 10MB</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Uploaded State */}
                  <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                          <i className="fas fa-file-csv text-emerald-600 text-xl"></i>
                        </div>
                        <div>
                          <p className="text-slate-800 font-semibold">Client_Billing_Requests_Export.csv</p>
                          <p className="text-slate-500 text-sm">2.4 MB • 1,247 rows • Uploaded just now</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowUploadedState(false)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        <i className="fas fa-trash mr-1"></i>Remove
                      </button>
                    </div>

                    {/* Column Mapping */}
                    <h4 className="font-semibold text-slate-800 mb-4">Column Mapping</h4>
                    <div className="space-y-4">
                      {[
                        { csv: 'Client ID', sample: '"WMC-001", "VCH-001"', mapped: 'client_id', status: 'ok' },
                        { csv: 'Account Number', sample: '"12345-6789", "34567-8901"', mapped: 'account_reference', status: 'ok' },
                        { csv: 'Type of Requests', sample: '"Insurance", "Dispute"', mapped: 'request_type', status: 'ok' },
                        { csv: 'Collector Notes', sample: 'May contain PHI', mapped: 'notes (sanitized)', status: 'warning' },
                      ].map((col) => (
                        <div
                          key={col.csv}
                          className={`grid grid-cols-1 md:grid-cols-2 gap-4 items-center p-4 rounded-lg ${
                            col.status === 'warning' ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'
                          }`}
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-700">CSV Column: "{col.csv}"</p>
                            <p className={`text-xs mt-0.5 ${col.status === 'warning' ? 'text-amber-600' : 'text-slate-500'}`}>
                              {col.status === 'warning' ? '⚠️ May contain PHI - will be sanitized' : `Sample: ${col.sample}`}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <i className="fas fa-arrow-right text-slate-400"></i>
                            <select className={`flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${col.status === 'warning' ? 'border-amber-300 focus:ring-amber-500' : 'border-slate-300 focus:ring-blue-500'}`}>
                              <option>{col.mapped}</option>
                              <option>Skip this column</option>
                            </select>
                            <i className={`fas ${col.status === 'warning' ? 'fa-exclamation-triangle text-amber-500' : 'fa-check-circle text-emerald-500'}`}></i>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Import Summary */}
                  <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h4 className="font-semibold text-slate-800 mb-4">Import Summary</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-emerald-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-emerald-700">1,189</p>
                        <p className="text-emerald-600 text-sm">Ready to Import</p>
                      </div>
                      <div className="bg-amber-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-amber-700">42</p>
                        <p className="text-amber-600 text-sm">Duplicates (Skip)</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-red-700">16</p>
                        <p className="text-red-600 text-sm">Errors (Fix Required)</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-blue-700">OPEN</p>
                        <p className="text-blue-600 text-sm">Default Status</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <button className="text-slate-600 hover:text-slate-800 font-medium text-sm">
                        <i className="fas fa-download mr-2"></i>Download Error Report
                      </button>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => setShowUploadedState(false)}
                          className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium text-sm"
                        >
                          Cancel
                        </button>
                        <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors">
                          <i className="fas fa-file-import mr-2"></i>Import 1,189 Requests
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Collectors Tab */}
          {activeTab === 'collectors' && (
            <div>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Collector Management</h1>
                <p className="text-slate-500 text-sm mt-1">Manage collector accounts and team assignments</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-users text-slate-400 text-2xl"></i>
                </div>
                <p className="text-slate-500">Collector management interface coming soon</p>
              </div>
            </div>
          )}

          {/* SLA Tab */}
          {activeTab === 'sla' && (
            <div>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800">SLA Settings</h1>
                <p className="text-slate-500 text-sm mt-1">Configure response time thresholds and escalation rules</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-clock text-slate-400 text-2xl"></i>
                </div>
                <p className="text-slate-500">SLA configuration interface coming soon</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Client Modal */}
      {showClientModal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={() => setShowClientModal(false)}></div>
          <div className="absolute inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-xl">
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden animate-modalSlide">
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800">
                  {editingClient ? 'Edit Client' : 'Add New Client'}
                </h2>
                <button onClick={() => setShowClientModal(false)} className="text-slate-400 hover:text-slate-600">
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Client Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Wesley Medical Center"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Client ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.code || ''}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder="e.g., WMC-001"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Industry</label>
                  <select className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>Healthcare</option>
                    <option>Commercial</option>
                    <option>Municipal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Primary Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="billing@client.com"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Response SLA</label>
                    <select
                      value={formData.sla_hours || 72}
                      onChange={(e) => setFormData({ ...formData, sla_hours: parseInt(e.target.value) })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={72}>3 business days</option>
                      <option value={120}>5 business days</option>
                      <option value={168}>7 business days</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                    <select
                      value={formData.is_active ? 'active' : 'inactive'}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-end space-x-3">
                <button
                  onClick={() => setShowClientModal(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveClient}
                  disabled={saving || !formData.name || !formData.code || !formData.email}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors flex items-center space-x-2"
                >
                  {saving ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Client</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes modalSlide {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-modalSlide { animation: modalSlide 0.3s ease-out; }
      `}</style>
    </div>
  );
}
