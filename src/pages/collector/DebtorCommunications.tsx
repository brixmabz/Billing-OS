import { useState } from 'react';
import Navbar from '../../components/layout/Navbar';
import SendToDebtorModal from '../../components/collector/SendToDebtorModal';
import type { DocType } from '../../components/collector/SendToDebtorModal';

interface Communication {
  id: string;
  accountNumber: string;
  debtorName: string;
  client: string;
  docType: DocType;
  docTypeLabel: string;
  deliveryMethod: 'email' | 'portal' | 'email_portal' | 'mail';
  sentBy: string;
  dateSent: string;
  timeSent: string;
  status: 'delivered' | 'viewed' | 'downloaded' | 'pending';
}

const mockCommunications: Communication[] = [
  {
    id: 'COM-001',
    accountNumber: '12345-6789',
    debtorName: 'J*** S****',
    client: 'Wesley Medical Center',
    docType: 'pif',
    docTypeLabel: 'PIF Letter',
    deliveryMethod: 'email',
    sentBy: 'System (Auto)',
    dateSent: 'Dec 20, 2024',
    timeSent: '3:42 PM',
    status: 'delivered',
  },
  {
    id: 'COM-002',
    accountNumber: '54321-9876',
    debtorName: 'M**** G*****',
    client: 'Via Christi Health',
    docType: 'sif',
    docTypeLabel: 'SIF Letter',
    deliveryMethod: 'email_portal',
    sentBy: 'Sarah Johnson',
    dateSent: 'Dec 19, 2024',
    timeSent: '11:15 AM',
    status: 'viewed',
  },
  {
    id: 'COM-003',
    accountNumber: '98765-4321',
    debtorName: 'R***** J******',
    client: 'Ascension Kansas',
    docType: 'itemized',
    docTypeLabel: 'Itemized Bill',
    deliveryMethod: 'portal',
    sentBy: 'Mike Chen',
    dateSent: 'Dec 18, 2024',
    timeSent: '2:30 PM',
    status: 'downloaded',
  },
  {
    id: 'COM-004',
    accountNumber: '11111-2222',
    debtorName: 'A*** W****',
    client: 'Stormont Vail Health',
    docType: 'validation',
    docTypeLabel: 'Validation Package',
    deliveryMethod: 'mail',
    sentBy: 'System (Auto)',
    dateSent: 'Dec 17, 2024',
    timeSent: '9:00 AM',
    status: 'pending',
  },
  {
    id: 'COM-005',
    accountNumber: '33333-4444',
    debtorName: 'L*** B*****',
    client: 'Wesley Medical Center',
    docType: 'pif',
    docTypeLabel: 'PIF Letter',
    deliveryMethod: 'email',
    sentBy: 'Sarah Johnson',
    dateSent: 'Dec 16, 2024',
    timeSent: '4:22 PM',
    status: 'viewed',
  },
];

const docTypes: { id: DocType; label: string; desc: string; icon: string; color: string }[] = [
  { id: 'pif', label: 'PIF Letter', desc: 'Paid in Full confirmation', icon: 'fa-file-invoice-dollar', color: 'emerald' },
  { id: 'sif', label: 'SIF Letter', desc: 'Settled in Full confirmation', icon: 'fa-file-contract', color: 'blue' },
  { id: 'itemized', label: 'Itemized Bill', desc: 'Detailed charge breakdown', icon: 'fa-list-check', color: 'violet' },
  { id: 'validation', label: 'Validation Package', desc: 'Debt validation documents', icon: 'fa-file-shield', color: 'amber' },
];

export default function DebtorCommunications() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<DocType | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<DocType>('pif');
  const [communications, setCommunications] = useState<Communication[]>(mockCommunications);

  const filteredCommunications = communications.filter((comm) => {
    const matchesSearch = comm.accountNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comm.debtorName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === 'all' || comm.docType === filterType;
    return matchesSearch && matchesFilter;
  });

  const handleOpenModal = (docType: DocType) => {
    setSelectedDocType(docType);
    setModalOpen(true);
  };

  const handleSend = (data: { accountNumber: string; deliveryMethod: string }) => {
    // Add new communication to the list
    const newComm: Communication = {
      id: `COM-${String(communications.length + 1).padStart(3, '0')}`,
      accountNumber: data.accountNumber,
      debtorName: 'New Debtor',
      client: 'Client Name',
      docType: selectedDocType,
      docTypeLabel: docTypes.find(d => d.id === selectedDocType)?.label || '',
      deliveryMethod: data.deliveryMethod as Communication['deliveryMethod'],
      sentBy: 'Current User',
      dateSent: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      timeSent: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      status: 'pending',
    };
    setCommunications([newComm, ...communications]);
  };

  const getDocTypeColorClasses = (docType: DocType) => {
    const colors: Record<DocType, string> = {
      pif: 'bg-emerald-100 text-emerald-700',
      sif: 'bg-blue-100 text-blue-700',
      itemized: 'bg-violet-100 text-violet-700',
      validation: 'bg-amber-100 text-amber-700',
    };
    return colors[docType];
  };

  const getDeliveryMethodLabel = (method: Communication['deliveryMethod']) => {
    const labels: Record<Communication['deliveryMethod'], { label: string; icon: string }> = {
      email: { label: 'Email', icon: 'fa-envelope' },
      portal: { label: 'Secure Portal', icon: 'fa-globe' },
      email_portal: { label: 'Email + Portal', icon: 'fa-layer-group' },
      mail: { label: 'Mail', icon: 'fa-mailbox' },
    };
    return labels[method];
  };

  const getStatusBadge = (status: Communication['status']) => {
    const badges: Record<Communication['status'], { label: string; classes: string; icon: string }> = {
      delivered: { label: 'Delivered', classes: 'bg-emerald-100 text-emerald-700', icon: 'fa-check-circle' },
      viewed: { label: 'Viewed', classes: 'bg-blue-100 text-blue-700', icon: 'fa-eye' },
      downloaded: { label: 'Downloaded', classes: 'bg-violet-100 text-violet-700', icon: 'fa-download' },
      pending: { label: 'Pending', classes: 'bg-slate-100 text-slate-600', icon: 'fa-clock' },
    };
    return badges[status];
  };

  const getQuickActionClasses = (color: string) => {
    const classes: Record<string, { bg: string; hover: string; icon: string }> = {
      emerald: { bg: 'bg-emerald-50', hover: 'hover:bg-emerald-100 hover:border-emerald-300', icon: 'text-emerald-600' },
      blue: { bg: 'bg-blue-50', hover: 'hover:bg-blue-100 hover:border-blue-300', icon: 'text-blue-600' },
      violet: { bg: 'bg-violet-50', hover: 'hover:bg-violet-100 hover:border-violet-300', icon: 'text-violet-600' },
      amber: { bg: 'bg-amber-50', hover: 'hover:bg-amber-100 hover:border-amber-300', icon: 'text-amber-600' },
    };
    return classes[color];
  };

  return (
    <div className="bg-slate-100 min-h-screen">
      <Navbar />

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Debtor Communications</h1>
          <p className="text-slate-500">Send secure documents to debtors including PIF letters, itemized bills, and validation packages.</p>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Quick Actions</h2>
          <div className="grid grid-cols-4 gap-4">
            {docTypes.map((doc) => {
              const colorClasses = getQuickActionClasses(doc.color);
              return (
                <button
                  key={doc.id}
                  onClick={() => handleOpenModal(doc.id)}
                  className={`${colorClasses.bg} ${colorClasses.hover} border border-slate-200 rounded-xl p-4 text-left transition-all group`}
                >
                  <div className={`w-10 h-10 ${colorClasses.bg} rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                    <i className={`fas ${doc.icon} ${colorClasses.icon} text-lg`}></i>
                  </div>
                  <h3 className="text-slate-800 font-semibold mb-1">{doc.label}</h3>
                  <p className="text-slate-500 text-sm">{doc.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recent Communications */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Table Header */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Recent Communications</h2>
            <div className="flex items-center space-x-3">
              {/* Search */}
              <div className="relative">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by account #..."
                  className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                />
              </div>
              {/* Filter */}
              <div className="relative">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as DocType | 'all')}
                  className="appearance-none bg-white border border-slate-300 rounded-lg px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Types</option>
                  {docTypes.map((doc) => (
                    <option key={doc.id} value={doc.id}>{doc.label}</option>
                  ))}
                </select>
                <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
              </div>
            </div>
          </div>

          {/* Table */}
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Account / Debtor</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Document Type</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Delivery</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Sent By</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date Sent</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCommunications.map((comm, index) => {
                const deliveryInfo = getDeliveryMethodLabel(comm.deliveryMethod);
                const statusBadge = getStatusBadge(comm.status);
                return (
                  <tr key={comm.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${index === filteredCommunications.length - 1 ? 'border-b-0' : ''}`}>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-slate-800 font-mono font-semibold text-sm">{comm.accountNumber}</p>
                        <p className="text-slate-500 text-xs">{comm.debtorName}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold ${getDocTypeColorClasses(comm.docType)}`}>
                        {comm.docTypeLabel}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2 text-slate-600 text-sm">
                        <i className={`fas ${deliveryInfo.icon} text-slate-400`}></i>
                        <span>{deliveryInfo.label}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-sm">{comm.sentBy}</td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-slate-700 text-sm">{comm.dateSent}</p>
                        <p className="text-slate-400 text-xs">{comm.timeSent}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold ${statusBadge.classes}`}>
                        <i className={`fas ${statusBadge.icon} mr-1.5 text-[10px]`}></i>
                        {statusBadge.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button className="text-slate-400 hover:text-blue-600 transition-colors" title="View">
                          <i className="fas fa-eye"></i>
                        </button>
                        <button className="text-slate-400 hover:text-emerald-600 transition-colors" title="Resend">
                          <i className="fas fa-redo"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Empty State */}
          {filteredCommunications.length === 0 && (
            <div className="px-6 py-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-inbox text-slate-400 text-2xl"></i>
              </div>
              <h3 className="text-slate-700 font-semibold mb-1">No communications found</h3>
              <p className="text-slate-500 text-sm">Try adjusting your search or filter criteria.</p>
            </div>
          )}

          {/* Pagination Footer */}
          {filteredCommunications.length > 0 && (
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
              <p className="text-slate-500 text-sm">
                Showing <span className="font-medium text-slate-700">1-{filteredCommunications.length}</span> of <span className="font-medium text-slate-700">{filteredCommunications.length}</span> communications
              </p>
              <div className="flex items-center space-x-2">
                <button className="px-3 py-1.5 text-slate-400 cursor-not-allowed text-sm">
                  <i className="fas fa-chevron-left mr-1"></i> Previous
                </button>
                <button className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium">1</button>
                <button className="px-3 py-1.5 text-slate-400 cursor-not-allowed text-sm">
                  Next <i className="fas fa-chevron-right ml-1"></i>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      <SendToDebtorModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        docType={selectedDocType}
        onSend={handleSend}
      />
    </div>
  );
}
