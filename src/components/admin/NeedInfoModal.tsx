import { useState, useEffect } from 'react';

interface NeedInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string, message: string) => void;
  request: {
    id: string;
    client: string;
    accountNumber: string;
    type: string;
    collectorName?: string;
  };
  loading?: boolean;
}

// Common reasons for requesting more info based on request types
const commonReasons = [
  { value: 'missing_policy_info', label: 'Missing policy/member ID' },
  { value: 'missing_payment_details', label: 'Missing payment details (date, amount, method)' },
  { value: 'missing_proof', label: 'Missing proof/documentation' },
  { value: 'unclear_dispute', label: 'Dispute details unclear' },
  { value: 'need_verification', label: 'Need identity verification details' },
  { value: 'incomplete_form', label: 'Form fields incomplete' },
  { value: 'other', label: 'Other (specify below)' },
];

export default function NeedInfoModal({ isOpen, onClose, onSubmit, request, loading }: NeedInfoModalProps) {
  const [selectedReason, setSelectedReason] = useState('');
  const [customMessage, setCustomMessage] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedReason('');
      setCustomMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!selectedReason) return;

    const reasonLabel = commonReasons.find(r => r.value === selectedReason)?.label || selectedReason;
    onSubmit(reasonLabel, customMessage);
  };

  const isValid = selectedReason && (selectedReason !== 'other' || customMessage.trim());

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose}></div>

      <div className="absolute inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden animate-slideUp">

          {/* Modal Header */}
          <div className="bg-gradient-to-r from-amber-600 to-amber-500 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <i className="fas fa-question-circle text-white"></i>
              </div>
              <div>
                <h2 className="text-white font-semibold text-lg">Request More Info</h2>
                <p className="text-amber-100 text-sm">{request.id} &bull; {request.client}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-amber-100 hover:text-white transition-colors">
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-6">
            {/* Request Info */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Account</p>
                  <p className="text-slate-800 font-mono">{request.accountNumber}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Request Type</p>
                  <p className="text-slate-800">{request.type}</p>
                </div>
                {request.collectorName && (
                  <div className="col-span-2">
                    <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Collector</p>
                    <p className="text-slate-800">{request.collectorName}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Reason Selection */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                What information is needed? <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedReason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  className="w-full appearance-none bg-white border border-slate-300 rounded-lg px-4 py-3 pr-10 text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                >
                  <option value="">Select a reason...</option>
                  {commonReasons.map((reason) => (
                    <option key={reason.value} value={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                  <i className="fas fa-chevron-down text-slate-400"></i>
                </div>
              </div>
            </div>

            {/* Custom Message */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Message to Collector {selectedReason === 'other' && <span className="text-red-500">*</span>}
              </label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Provide additional details or specific instructions..."
                rows={4}
                maxLength={2000}
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
              />
              <div className="flex justify-between mt-1">
                <p className="text-slate-400 text-xs">
                  <i className="fas fa-info-circle mr-1"></i>
                  This will be added to the request timeline
                </p>
                <p className="text-slate-400 text-xs">{customMessage.length}/2000</p>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <i className="fas fa-bell text-amber-600 mt-0.5"></i>
                <div>
                  <p className="text-amber-800 font-semibold text-sm">Collector will be notified</p>
                  <p className="text-amber-700 text-xs">The request will stay claimed to you. The collector will see this in their request timeline.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex items-center justify-end space-x-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium text-sm transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isValid || loading}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-lg font-semibold text-sm transition-colors disabled:cursor-not-allowed"
            >
              {loading ? (
                <><i className="fas fa-spinner fa-spin mr-2"></i>Sending...</>
              ) : (
                <><i className="fas fa-paper-plane mr-2"></i>Request Info</>
              )}
            </button>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
      `}</style>
    </div>
  );
}
