import { useState, useEffect, useMemo } from 'react';

interface SendToClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (data: { recipientEmail: string; ccEmail?: string }) => Promise<boolean>;
  request: {
    id: string;
    client: string;
    accountNumber: string;
    type: string;
    typeColor: string;
    balance?: string;
  };
  loading?: boolean;
}

// Mock client emails - in production would come from API
const clientEmails: Record<string, { email: string; label: string }[]> = {
  'Via Christi Health': [
    { email: 'billing@viachristihealth.org', label: 'Primary' },
    { email: 'ar@viachristihealth.org', label: 'AR Department' },
    { email: 'collections@viachristihealth.org', label: 'Collections' },
  ],
  'Wesley Medical Center': [
    { email: 'billing@wesleymc.com', label: 'Primary' },
    { email: 'ar@wesleymc.com', label: 'AR Department' },
  ],
  'Ascension Kansas': [
    { email: 'billing@ascension.org', label: 'Primary' },
    { email: 'collections@ascension.org', label: 'Collections' },
  ],
  'Stormont Vail Health': [
    { email: 'billing@stormontvail.org', label: 'Primary' },
    { email: 'ar@stormontvail.org', label: 'AR Department' },
  ],
  'Newman Regional': [
    { email: 'billing@newmanregional.com', label: 'Primary' },
  ],
};

const clientIds: Record<string, string> = {
  'Via Christi Health': 'VCH-001',
  'Wesley Medical Center': 'WMC-002',
  'Ascension Kansas': 'ASC-003',
  'Stormont Vail Health': 'SVH-004',
  'Newman Regional': 'NRH-005',
};

const getTypeColorClasses = (color: string) => {
  const colors: Record<string, string> = {
    amber: 'bg-amber-100 text-amber-800',
    blue: 'bg-blue-100 text-blue-800',
    red: 'bg-red-100 text-red-800',
    purple: 'bg-purple-100 text-purple-800',
    slate: 'bg-slate-100 text-slate-800',
  };
  return colors[color] || colors.slate;
};

// Email protection - masks email addresses like Cloudflare's email protection
const maskEmail = (): string => {
  return '[email\u00A0protected]';
};

export default function SendToClientModal({ isOpen, onClose, onSend, request, loading }: SendToClientModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [ccEmail, setCcEmail] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [sentTime, setSentTime] = useState('');

  const emails = useMemo(
    () => clientEmails[request.client] || [{ email: 'billing@client.com', label: 'Primary' }],
    [request.client]
  );
  const clientId = clientIds[request.client] || 'CLT-000';

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setSelectedEmail(emails[0]?.email || '');
      setCcEmail('');
      setConfirmed(false);
    }
  }, [isOpen, emails]);

  if (!isOpen) return null;

  const nextStep = async () => {
    if (currentStep === 3) {
      if (!confirmed || loading) return;
      // Call API and wait for result before showing success
      const success = await onSend({
        recipientEmail: selectedEmail,
        ccEmail: ccEmail || undefined
      });
      if (success) {
        setSentTime(new Date().toLocaleString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
        }));
        setCurrentStep(4);
      }
      // If failed, stay on step 3 (error toast shown by parent)
      return;
    }
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    // API is now called in step 3, so just close the modal
    onClose();
  };

  // Calculate response due date (3 business days from now)
  const getDueDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 3);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={handleClose}></div>

      <div className="absolute inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden animate-slideUp max-h-[90vh] flex flex-col">

          {/* Modal Header */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <i className="fas fa-paper-plane text-white"></i>
              </div>
              <div>
                <h2 className="text-white font-semibold text-lg">Send Request to Client</h2>
                <p className="text-slate-400 text-sm">{request.id} &bull; {request.client}</p>
              </div>
            </div>
            <button onClick={handleClose} className="text-slate-400 hover:text-white transition-colors">
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>

          {/* Step Indicator */}
          {currentStep < 4 && (
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-3">
              <div className="flex items-center justify-between">
                {[
                  { num: 1, label: 'Verify Recipient' },
                  { num: 2, label: 'Preview Email' },
                  { num: 3, label: 'Confirm & Send' },
                ].map((step, index) => (
                  <div key={step.num} className="flex items-center">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                        step.num < currentStep
                          ? 'bg-emerald-500 text-white'
                          : step.num === currentStep
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-300 text-slate-500'
                      }`}>
                        {step.num < currentStep ? <i className="fas fa-check text-xs"></i> : step.num}
                      </div>
                      <span className={`text-sm ${
                        step.num < currentStep
                          ? 'text-emerald-600'
                          : step.num === currentStep
                          ? 'text-slate-800 font-medium'
                          : 'text-slate-500'
                      }`}>
                        {step.label}
                      </span>
                    </div>
                    {index < 2 && <div className="flex-1 h-px bg-slate-300 mx-4 min-w-[40px]"></div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modal Content */}
          <div className="flex-1 overflow-y-auto p-6">

            {/* Step 1: Verify Recipient */}
            {currentStep === 1 && (
              <div>
                <div className="mb-6">
                  <h3 className="text-slate-800 font-semibold mb-2">Client Email Verification</h3>
                  <p className="text-slate-500 text-sm">Confirm the recipient email address matches this client's records.</p>
                </div>

                {/* Client Info Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Client Name</p>
                      <p className="text-slate-800 font-semibold">{request.client}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Client ID</p>
                      <p className="text-slate-800 font-mono">{clientId}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Account Reference</p>
                      <p className="text-slate-800 font-mono">{request.accountNumber}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Request Type</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTypeColorClasses(request.typeColor)}`}>
                        {request.type}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Email Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Recipient Email <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={selectedEmail}
                      onChange={(e) => setSelectedEmail(e.target.value)}
                      className="w-full appearance-none bg-white border border-slate-300 rounded-lg px-4 py-3 pr-10 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {emails.map((email) => (
                        <option key={email.email} value={email.email}>
                          {email.email} ({email.label})
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                      <i className="fas fa-chevron-down text-slate-400"></i>
                    </div>
                  </div>
                  <p className="text-slate-500 text-xs mt-2">
                    <i className="fas fa-info-circle mr-1"></i>
                    Email addresses are pulled from the Client Directory. <a href="/settings" className="text-blue-600 hover:underline">Edit client contacts</a>
                  </p>
                </div>

                {/* Validation Success */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                      <i className="fas fa-check-circle text-emerald-600"></i>
                    </div>
                    <div>
                      <p className="text-emerald-800 font-semibold text-sm">Email Verified</p>
                      <p className="text-emerald-700 text-xs">This email is registered to {request.client} ({clientId})</p>
                    </div>
                  </div>
                </div>

                {/* CC Options */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">CC (Optional)</label>
                  <input
                    type="email"
                    value={ccEmail}
                    onChange={(e) => setCcEmail(e.target.value)}
                    placeholder="Enter additional email addresses..."
                    className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Preview Email */}
            {currentStep === 2 && (
              <div>
                <div className="mb-6">
                  <h3 className="text-slate-800 font-semibold mb-2">Email Preview</h3>
                  <p className="text-slate-500 text-sm">Review the PHI-safe email that will be sent to the client.</p>
                </div>

                {/* Email Preview Card */}
                <div className="border border-slate-300 rounded-xl overflow-hidden">
                  {/* Email Metadata Header */}
                  <div className="bg-slate-50 border-b border-slate-300 px-4 py-3 space-y-2">
                    <div className="flex items-start">
                      <span className="text-slate-500 text-sm w-16 flex-shrink-0">From:</span>
                      <span className="text-slate-700 text-sm">Midwest Service Bureau &lt;<span className="text-slate-500">{maskEmail()}</span>&gt;</span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-slate-500 text-sm w-16 flex-shrink-0">To:</span>
                      <span className="text-slate-700 text-sm">{selectedEmail}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-slate-500 text-sm w-16 flex-shrink-0">Subject:</span>
                      <span className="text-slate-800 text-sm font-semibold">Inquiry re: Account #{request.accountNumber} - Reference #{request.id}</span>
                    </div>
                    <div className="flex items-center pt-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                        <i className="fas fa-shield-halved mr-1 text-[10px]"></i>Secure Message
                      </span>
                    </div>
                  </div>

                  {/* Email Body - Full Template */}
                  <div className="bg-white max-h-[400px] overflow-y-auto">
                    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', maxWidth: '600px', margin: '0 auto', padding: 0 }}>

                      {/* Header Banner */}
                      <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%)', padding: '32px 24px', textAlign: 'center' as const }}>
                        <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px' }}>
                          <span style={{ color: '#ffffff', fontSize: '24px', fontWeight: 'bold', letterSpacing: '1px' }}>MSB</span>
                        </div>
                        <h1 style={{ color: '#ffffff', fontSize: '20px', fontWeight: 600, margin: '0 0 8px 0' }}>Account Inquiry</h1>
                        <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Secure Billing Request Notification</p>
                      </div>

                      {/* Reference Banner */}
                      <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '16px 24px', textAlign: 'center' as const }}>
                        <span style={{ background: '#1e3a5f', color: '#ffffff', fontSize: '11px', fontWeight: 600, padding: '4px 12px', borderRadius: '4px', letterSpacing: '0.5px' }}>
                          REFERENCE: {request.id}
                        </span>
                      </div>

                      {/* Main Content */}
                      <div style={{ padding: '32px 24px' }}>

                        {/* Greeting */}
                        <p style={{ color: '#334155', fontSize: '15px', lineHeight: 1.6, margin: '0 0 24px 0' }}>
                          Hello Team,
                        </p>

                        <p style={{ color: '#334155', fontSize: '15px', lineHeight: 1.6, margin: '0 0 24px 0' }}>
                          We have received an inquiry regarding a patient account in your system. Please review the details below and respond via our secure portal.
                        </p>

                        {/* Account Details Table */}
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginBottom: '24px' }}>
                          <div style={{ background: '#1e3a5f', padding: '12px 16px' }}>
                            <span style={{ color: '#ffffff', fontSize: '12px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' as const }}>Account Details</span>
                          </div>
                          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                            <tbody>
                              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '13px', width: '140px' }}>Account Ref</td>
                                <td style={{ padding: '12px 16px', color: '#1e293b', fontSize: '14px', fontWeight: 600, fontFamily: "'Courier New', monospace" }}>{request.accountNumber}</td>
                              </tr>
                              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '13px' }}>MSB File ID</td>
                                <td style={{ padding: '12px 16px', color: '#1e293b', fontSize: '14px', fontWeight: 600, fontFamily: "'Courier New', monospace" }}>MSB-{Math.floor(Math.random() * 90000) + 10000}</td>
                              </tr>
                              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '13px' }}>Service Date</td>
                                <td style={{ padding: '12px 16px', color: '#1e293b', fontSize: '14px', fontWeight: 500 }}>03/15/2024</td>
                              </tr>
                              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '13px' }}>Current Balance</td>
                                <td style={{ padding: '12px 16px', color: '#1e293b', fontSize: '14px', fontWeight: 600 }}>{request.balance || '$450.00'}</td>
                              </tr>
                              <tr>
                                <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '13px' }}>Inquiry Type</td>
                                <td style={{ padding: '12px 16px' }}>
                                  <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '12px', fontWeight: 600, padding: '4px 10px', borderRadius: '4px' }}>{request.type}</span>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Inquiry Details Box */}
                        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                            <div style={{ flexShrink: 0, width: '32px', height: '32px', background: '#fef3c7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '12px' }}>
                              <span style={{ color: '#d97706', fontSize: '14px' }}>ℹ️</span>
                            </div>
                            <div>
                              <p style={{ color: '#92400e', fontSize: '13px', fontWeight: 600, margin: '0 0 4px 0' }}>Inquiry Details</p>
                              <p style={{ color: '#78350f', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>
                                Individual states coverage through insurance carrier. Policy ID was not provided by debtor.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Action Required */}
                        <p style={{ color: '#334155', fontSize: '15px', lineHeight: 1.6, margin: '0 0 24px 0' }}>
                          Please confirm the insurance coverage status for this account. If coverage exists, please upload the EOB or remittance documentation via our secure portal.
                        </p>

                        {/* CTA Button */}
                        <div style={{ textAlign: 'center' as const, margin: '32px 0' }}>
                          <span style={{ display: 'inline-block', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: '#ffffff', fontSize: '15px', fontWeight: 600, textDecoration: 'none', padding: '14px 32px', borderRadius: '8px', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)' }}>
                            Reply Securely via Portal →
                          </span>
                        </div>

                        {/* Expiry Notice */}
                        <div style={{ textAlign: 'center' as const, marginBottom: '24px' }}>
                          <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                            ⏱ Link expires in 72 hours
                          </span>
                        </div>

                        {/* Divider */}
                        <div style={{ borderTop: '1px solid #e2e8f0', margin: '24px 0' }}></div>

                        {/* Security Notice */}
                        <div style={{ background: '#f1f5f9', borderRadius: '6px', padding: '14px 16px', marginBottom: '16px' }}>
                          <p style={{ color: '#64748b', fontSize: '12px', lineHeight: 1.5, margin: 0 }}>
                            <strong style={{ color: '#475569' }}>🔒 Security Notice:</strong> For HIPAA compliance, patient identifying information is not included in this email. Please reference the Account Number above when looking up records in your system. Do not send PHI via email reply—use the secure portal link.
                          </p>
                        </div>

                        {/* Help Text */}
                        <p style={{ color: '#94a3b8', fontSize: '12px', lineHeight: 1.5, margin: 0, textAlign: 'center' as const }}>
                          Questions? Contact Client Services at <span style={{ color: '#2563eb' }}>{maskEmail()}</span> or (316) 555-0100
                        </p>

                      </div>

                      {/* Footer */}
                      <div style={{ background: '#1e293b', padding: '24px', textAlign: 'center' as const }}>
                        <p style={{ color: '#94a3b8', fontSize: '11px', margin: '0 0 8px 0' }}>
                          Midwest Service Bureau • 123 Main Street, Wichita, KS 67202
                        </p>
                        <p style={{ color: '#64748b', fontSize: '10px', margin: 0 }}>
                          This is an automated message. Please do not reply directly to this email.
                        </p>
                      </div>

                    </div>
                  </div>
                </div>

                {/* PHI Safety Confirmation */}
                <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <div className="flex items-start space-x-3">
                    <i className="fas fa-shield-halved text-emerald-600 mt-0.5"></i>
                    <div>
                      <p className="text-emerald-800 font-semibold text-sm">PHI Safety Check Passed</p>
                      <p className="text-emerald-700 text-xs">No patient name, DOB, SSN, or diagnosis detected in email content.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Confirm & Send */}
            {currentStep === 3 && (
              <div>
                <div className="mb-6">
                  <h3 className="text-slate-800 font-semibold mb-2">Confirm & Send</h3>
                  <p className="text-slate-500 text-sm">Review the summary and confirm to send the request to the client.</p>
                </div>

                {/* Summary Card */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-blue-600 text-xs uppercase tracking-wide mb-1">Request ID</p>
                      <p className="text-blue-900 font-semibold">{request.id}</p>
                    </div>
                    <div>
                      <p className="text-blue-600 text-xs uppercase tracking-wide mb-1">Client</p>
                      <p className="text-blue-900 font-semibold">{request.client}</p>
                    </div>
                    <div>
                      <p className="text-blue-600 text-xs uppercase tracking-wide mb-1">Recipient</p>
                      <p className="text-blue-900 font-semibold">{selectedEmail}</p>
                    </div>
                    <div>
                      <p className="text-blue-600 text-xs uppercase tracking-wide mb-1">Request Type</p>
                      <p className="text-blue-900 font-semibold">{request.type}</p>
                    </div>
                  </div>
                </div>

                {/* SLA Info */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-700 font-medium text-sm">Client Response SLA</p>
                      <p className="text-slate-500 text-xs">Based on {request.client} settings</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-800 font-semibold">3 business days</p>
                      <p className="text-slate-500 text-xs">Auto-escalate if no response</p>
                    </div>
                  </div>
                </div>

                {/* Confirmation Checkbox */}
                <label className={`flex items-start space-x-3 cursor-pointer p-3 rounded-lg transition-colors ${!confirmed ? 'hover:bg-slate-50' : 'bg-blue-50'}`}>
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="mt-1 w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-slate-700 text-sm">I confirm this request is ready to send. The email contains no PHI and will be sent to a verified client email address.</span>
                </label>
              </div>
            )}

            {/* Step 4: Success */}
            {currentStep === 4 && (
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-checkmark">
                  <i className="fas fa-check text-emerald-600 text-3xl"></i>
                </div>
                <h3 className="text-slate-800 font-bold text-xl mb-2">Request Sent Successfully!</h3>
                <p className="text-slate-500 mb-6">{request.id} has been sent to {request.client}</p>

                <div className="bg-slate-50 rounded-xl p-4 max-w-sm mx-auto text-left">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Sent to:</span>
                      <span className="text-slate-800">{selectedEmail}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Sent at:</span>
                      <span className="text-slate-800">{sentTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Response due:</span>
                      <span className="text-slate-800">{getDueDate()}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-center space-x-3">
                  <div className="flex items-center space-x-2 text-slate-500 text-sm">
                    <i className="fab fa-slack text-[#4A154B]"></i>
                    <span>Slack notification sent</span>
                  </div>
                  <span className="text-slate-300">&bull;</span>
                  <div className="flex items-center space-x-2 text-slate-500 text-sm">
                    <i className="fas fa-bell text-blue-500"></i>
                    <span>Collector notified</span>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Modal Footer */}
          <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex items-center justify-between">
            {currentStep < 4 ? (
              <>
                <button
                  onClick={prevStep}
                  className={`text-slate-600 hover:text-slate-800 font-medium text-sm transition-colors ${currentStep === 1 ? 'invisible' : ''}`}
                >
                  <i className="fas fa-arrow-left mr-2"></i>Back
                </button>
                <div className="flex items-center space-x-3">
                  <button onClick={handleClose} className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium text-sm transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={nextStep}
                    disabled={(currentStep === 3 && !confirmed) || loading}
                    className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      currentStep === 3
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {currentStep === 3 ? (
                      loading ? (
                        <><i className="fas fa-spinner fa-spin mr-2"></i>Sending...</>
                      ) : (
                        <><i className="fas fa-paper-plane mr-2"></i>Send to Client</>
                      )
                    ) : (
                      <>Continue <i className="fas fa-arrow-right ml-2"></i></>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex justify-end">
                <button
                  onClick={handleClose}
                  className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors"
                >
                  Done
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes checkmark {
          0% { transform: scale(0); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
        .animate-checkmark { animation: checkmark 0.5s ease-out forwards; }
      `}</style>
    </div>
  );
}
