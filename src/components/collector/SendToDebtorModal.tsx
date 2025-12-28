import { useState, useEffect } from 'react';

export type DocType = 'pif' | 'sif' | 'itemized' | 'validation';

interface SendToDebtorModalProps {
  isOpen: boolean;
  onClose: () => void;
  docType: DocType;
  onSend: (data: { accountNumber: string; deliveryMethod: string }) => void;
}

interface AccountData {
  accountNumber: string;
  fileId: string;
  debtorName: string;
  maskedName: string;
  originalBalance: string;
  currentBalance: string;
  paidDate: string;
  status: string;
  statusColor: string;
  email: string;
  language: string;
}

const docTypeConfig: Record<DocType, { label: string; icon: string; color: string; description: string }> = {
  pif: { label: 'PIF Letter', icon: 'fa-file-invoice-dollar', color: 'emerald', description: 'Paid in Full confirmation letter' },
  sif: { label: 'SIF Letter', icon: 'fa-file-contract', color: 'blue', description: 'Settled in Full confirmation letter' },
  itemized: { label: 'Itemized Bill', icon: 'fa-list-check', color: 'violet', description: 'Detailed charge breakdown' },
  validation: { label: 'Validation Package', icon: 'fa-file-shield', color: 'amber', description: 'Debt validation documents' },
};

// Mock account lookup - in production would come from API
const mockAccountLookup = (accountNumber: string): AccountData | null => {
  const accounts: Record<string, AccountData> = {
    '12345-6789': {
      accountNumber: '12345-6789',
      fileId: 'MSB-98765',
      debtorName: 'John Smith',
      maskedName: 'J*** S****',
      originalBalance: '$1,245.00',
      currentBalance: '$0.00',
      paidDate: 'Dec 15, 2024',
      status: 'Paid in Full',
      statusColor: 'emerald',
      email: 'j***@email.com',
      language: 'English',
    },
    '54321-9876': {
      accountNumber: '54321-9876',
      fileId: 'MSB-54321',
      debtorName: 'Maria Garcia',
      maskedName: 'M**** G*****',
      originalBalance: '$2,500.00',
      currentBalance: '$1,250.00',
      paidDate: 'Dec 18, 2024',
      status: 'Settled',
      statusColor: 'blue',
      email: 'm****@email.com',
      language: 'Spanish',
    },
    '98765-4321': {
      accountNumber: '98765-4321',
      fileId: 'MSB-11111',
      debtorName: 'Robert Johnson',
      maskedName: 'R***** J******',
      originalBalance: '$875.00',
      currentBalance: '$875.00',
      paidDate: '',
      status: 'Active',
      statusColor: 'amber',
      email: 'r*****@email.com',
      language: 'English',
    },
  };
  return accounts[accountNumber] || null;
};

export default function SendToDebtorModal({ isOpen, onClose, docType, onSend }: SendToDebtorModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [accountInput, setAccountInput] = useState('');
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'email' | 'portal' | 'mail'>('email');
  const [sentTime, setSentTime] = useState('');

  const config = docTypeConfig[docType];

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setAccountInput('');
      setAccountData(null);
      setLookupError('');
      setDeliveryMethod('email');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLookup = () => {
    setLookupError('');
    const result = mockAccountLookup(accountInput.trim());
    if (result) {
      setAccountData(result);
    } else {
      setLookupError('No account found with that number. Please check and try again.');
    }
  };

  const nextStep = () => {
    if (currentStep === 2) {
      // Send action
      setSentTime(new Date().toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
      }));
      setCurrentStep(3);
      return;
    }
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    if (currentStep === 3 && accountData) {
      onSend({ accountNumber: accountData.accountNumber, deliveryMethod });
    }
    onClose();
  };

  const getStatusColorClasses = (color: string) => {
    const colors: Record<string, string> = {
      emerald: 'bg-emerald-100 text-emerald-800',
      blue: 'bg-blue-100 text-blue-800',
      amber: 'bg-amber-100 text-amber-800',
      red: 'bg-red-100 text-red-800',
    };
    return colors[color] || colors.amber;
  };

  const getDocColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; icon: string; badge: string }> = {
      emerald: { bg: 'bg-emerald-500', icon: 'text-white', badge: 'bg-emerald-100 text-emerald-700' },
      blue: { bg: 'bg-blue-500', icon: 'text-white', badge: 'bg-blue-100 text-blue-700' },
      violet: { bg: 'bg-violet-500', icon: 'text-white', badge: 'bg-violet-100 text-violet-700' },
      amber: { bg: 'bg-amber-500', icon: 'text-white', badge: 'bg-amber-100 text-amber-700' },
    };
    return colors[color] || colors.blue;
  };

  const docColors = getDocColorClasses(config.color);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={handleClose}></div>

      <div className="absolute inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden animate-slideUp max-h-[90vh] flex flex-col">

          {/* Modal Header */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 ${docColors.bg} rounded-lg flex items-center justify-center`}>
                <i className={`fas ${config.icon} ${docColors.icon}`}></i>
              </div>
              <div>
                <h2 className="text-white font-semibold text-lg">Send {config.label}</h2>
                <p className="text-slate-400 text-sm">{config.description}</p>
              </div>
            </div>
            <button onClick={handleClose} className="text-slate-400 hover:text-white transition-colors">
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>

          {/* Step Indicator */}
          {currentStep < 3 && (
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-3">
              <div className="flex items-center justify-between">
                {[
                  { num: 1, label: 'Account Lookup' },
                  { num: 2, label: 'Preview & Confirm' },
                ].map((step, index) => (
                  <div key={step.num} className="flex items-center flex-1">
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
                    {index < 1 && <div className="flex-1 h-px bg-slate-300 mx-4 min-w-[40px]"></div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modal Content */}
          <div className="flex-1 overflow-y-auto p-6">

            {/* Step 1: Account Lookup */}
            {currentStep === 1 && (
              <div>
                <div className="mb-6">
                  <h3 className="text-slate-800 font-semibold mb-2">Find Debtor Account</h3>
                  <p className="text-slate-500 text-sm">Enter the account number or file ID to look up the debtor record.</p>
                </div>

                {/* Account Search */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Account Number / File ID <span className="text-red-500">*</span>
                  </label>
                  <div className="flex space-x-3">
                    <input
                      type="text"
                      value={accountInput}
                      onChange={(e) => setAccountInput(e.target.value)}
                      placeholder="e.g., 12345-6789 or MSB-98765"
                      className="flex-1 bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleLookup}
                      disabled={!accountInput.trim()}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                    >
                      <i className="fas fa-search mr-2"></i>Lookup
                    </button>
                  </div>
                  {lookupError && (
                    <p className="text-red-600 text-sm mt-2">
                      <i className="fas fa-exclamation-circle mr-1"></i>{lookupError}
                    </p>
                  )}
                  <p className="text-slate-400 text-xs mt-2">
                    Demo accounts: 12345-6789, 54321-9876, 98765-4321
                  </p>
                </div>

                {/* Account Found */}
                {accountData && (
                  <>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                          <i className="fas fa-check-circle text-emerald-600"></i>
                        </div>
                        <div>
                          <p className="text-emerald-800 font-semibold text-sm">Account Found</p>
                          <p className="text-emerald-700 text-xs">Record verified in system</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-emerald-600 uppercase tracking-wide mb-1">Account #</p>
                          <p className="text-emerald-900 font-mono font-semibold">{accountData.accountNumber}</p>
                        </div>
                        <div>
                          <p className="text-xs text-emerald-600 uppercase tracking-wide mb-1">File ID</p>
                          <p className="text-emerald-900 font-mono font-semibold">{accountData.fileId}</p>
                        </div>
                        <div>
                          <p className="text-xs text-emerald-600 uppercase tracking-wide mb-1">Original Balance</p>
                          <p className="text-emerald-900 font-semibold">{accountData.originalBalance}</p>
                        </div>
                        <div>
                          <p className="text-xs text-emerald-600 uppercase tracking-wide mb-1">{accountData.paidDate ? 'Paid Date' : 'Current Balance'}</p>
                          <p className="text-emerald-900 font-semibold">{accountData.paidDate || accountData.currentBalance}</p>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-emerald-200">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusColorClasses(accountData.statusColor)}`}>
                          <i className="fas fa-circle text-[6px] mr-2"></i>
                          {accountData.status}
                        </span>
                      </div>
                    </div>

                    {/* Debtor Contact */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
                      <h4 className="text-slate-700 font-semibold text-sm mb-3">
                        <i className="fas fa-user-shield mr-2 text-slate-400"></i>
                        Debtor Contact (PHI Protected)
                      </h4>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Name</p>
                          <p className="text-slate-800 font-medium">{accountData.maskedName}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Language Preference</p>
                          <p className="text-slate-800 font-medium">{accountData.language}</p>
                        </div>
                      </div>

                      {/* Delivery Method Selection */}
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Delivery Method</p>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { id: 'email', label: 'Email', icon: 'fa-envelope', desc: 'Secure email link' },
                            { id: 'portal', label: 'Portal Only', icon: 'fa-globe', desc: 'Web portal access' },
                            { id: 'mail', label: 'Mail', icon: 'fa-mailbox', desc: 'Physical letter' },
                          ].map((method) => (
                            <button
                              key={method.id}
                              onClick={() => setDeliveryMethod(method.id as 'email' | 'portal' | 'mail')}
                              className={`p-3 rounded-lg border-2 transition-all text-left ${
                                deliveryMethod === method.id
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <i className={`fas ${method.icon} ${deliveryMethod === method.id ? 'text-blue-600' : 'text-slate-400'} mb-2`}></i>
                              <p className={`text-sm font-medium ${deliveryMethod === method.id ? 'text-blue-700' : 'text-slate-700'}`}>{method.label}</p>
                              <p className="text-xs text-slate-500">{method.desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 2: Preview & Confirm */}
            {currentStep === 2 && accountData && (
              <div>
                <div className="mb-6">
                  <h3 className="text-slate-800 font-semibold mb-2">Preview Document</h3>
                  <p className="text-slate-500 text-sm">Review the document that will be sent to the debtor.</p>
                </div>

                {/* Document Preview */}
                <div className="border border-slate-300 rounded-xl overflow-hidden mb-6">
                  <div className="bg-slate-100 border-b border-slate-300 px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <i className={`fas ${config.icon} text-slate-500`}></i>
                      <span className="text-slate-700 font-medium text-sm">{config.label} Preview</span>
                    </div>
                    <span className={`${docColors.badge} px-2 py-0.5 rounded text-xs font-medium`}>
                      {deliveryMethod === 'email' ? 'Email' : deliveryMethod === 'portal' ? 'Portal' : 'Mail'}
                    </span>
                  </div>

                  {/* Letter Preview */}
                  <div className="bg-white p-6 max-h-[300px] overflow-y-auto">
                    <div className="border border-slate-200 rounded-lg p-6 bg-slate-50">
                      {/* Letter Header */}
                      <div className="text-center mb-6 pb-4 border-b border-slate-200">
                        <div className="inline-block bg-slate-800 text-white font-bold px-4 py-2 rounded mb-2">MSB</div>
                        <p className="text-slate-600 text-sm">Midwest Service Bureau</p>
                        <p className="text-slate-500 text-xs">123 Main Street, Wichita, KS 67202</p>
                      </div>

                      {/* Letter Body */}
                      <div className="text-sm text-slate-700 space-y-4">
                        <p className="text-right text-slate-500">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

                        <p>RE: Account #{accountData.accountNumber}</p>

                        <p>Dear {accountData.maskedName},</p>

                        {docType === 'pif' && (
                          <p>
                            This letter confirms that the above-referenced account has been <strong>Paid in Full</strong>.
                            Your final payment of {accountData.originalBalance} was received and processed on {accountData.paidDate}.
                            This account is now closed with a zero balance.
                          </p>
                        )}

                        {docType === 'sif' && (
                          <p>
                            This letter confirms that the above-referenced account has been <strong>Settled in Full</strong>.
                            A settlement agreement was reached and fulfilled. This account is now closed and considered resolved.
                          </p>
                        )}

                        {docType === 'itemized' && (
                          <>
                            <p>As requested, please find below an itemized breakdown of charges for the above account:</p>
                            <div className="bg-white border border-slate-200 rounded p-3 my-4">
                              <div className="flex justify-between py-1 border-b border-slate-100">
                                <span>Original Service Amount</span>
                                <span className="font-mono">{accountData.originalBalance}</span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-100">
                                <span>Insurance Payments</span>
                                <span className="font-mono">-$0.00</span>
                              </div>
                              <div className="flex justify-between py-1 font-semibold">
                                <span>Balance Due</span>
                                <span className="font-mono">{accountData.currentBalance}</span>
                              </div>
                            </div>
                          </>
                        )}

                        {docType === 'validation' && (
                          <p>
                            In response to your request for debt validation, enclosed you will find documentation
                            supporting the validity of this debt including the original creditor information,
                            itemized statement of charges, and assignment documentation.
                          </p>
                        )}

                        <p className="mt-6">
                          If you have any questions, please contact us at (316) 555-0100 or visit our secure portal.
                        </p>

                        <p className="mt-4">
                          Sincerely,<br/>
                          <strong>Midwest Service Bureau</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Delivery Info */}
                {deliveryMethod === 'email' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <i className="fas fa-envelope text-blue-600"></i>
                      </div>
                      <div>
                        <p className="text-blue-800 font-semibold text-sm">Email Delivery</p>
                        <p className="text-blue-700 text-xs">Document will be sent to {accountData.email} with secure download link</p>
                      </div>
                    </div>
                  </div>
                )}

                {deliveryMethod === 'portal' && (
                  <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center">
                        <i className="fas fa-globe text-violet-600"></i>
                      </div>
                      <div>
                        <p className="text-violet-800 font-semibold text-sm">Portal Delivery</p>
                        <p className="text-violet-700 text-xs">Document will be available in debtor's secure portal</p>
                      </div>
                    </div>
                  </div>
                )}

                {deliveryMethod === 'mail' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                        <i className="fas fa-mailbox text-amber-600"></i>
                      </div>
                      <div>
                        <p className="text-amber-800 font-semibold text-sm">Mail Delivery</p>
                        <p className="text-amber-700 text-xs">Physical letter will be mailed to address on file</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* PHI Notice */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <div className="flex items-start space-x-3">
                    <i className="fas fa-shield-halved text-emerald-600 mt-0.5"></i>
                    <div>
                      <p className="text-emerald-800 font-semibold text-sm">Secure Delivery Confirmed</p>
                      <p className="text-emerald-700 text-xs">Document will be delivered via HIPAA-compliant secure channel. All transmissions are encrypted.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Success */}
            {currentStep === 3 && accountData && (
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-checkmark">
                  <i className="fas fa-check text-emerald-600 text-3xl"></i>
                </div>
                <h3 className="text-slate-800 font-bold text-xl mb-2">Document Sent Successfully!</h3>
                <p className="text-slate-500 mb-6">{config.label} has been queued for delivery</p>

                <div className="bg-slate-50 rounded-xl p-4 max-w-sm mx-auto text-left">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Account:</span>
                      <span className="text-slate-800 font-mono">{accountData.accountNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Document:</span>
                      <span className="text-slate-800">{config.label}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Delivery:</span>
                      <span className="text-slate-800 capitalize">{deliveryMethod}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Sent at:</span>
                      <span className="text-slate-800">{sentTime}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-center space-x-2 text-slate-500 text-sm">
                  <i className="fas fa-history text-blue-500"></i>
                  <span>Logged in Communication History</span>
                </div>
              </div>
            )}

          </div>

          {/* Modal Footer */}
          <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex items-center justify-between">
            {currentStep < 3 ? (
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
                  {currentStep === 1 ? (
                    <button
                      onClick={nextStep}
                      disabled={!accountData}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-sm transition-colors"
                    >
                      Continue <i className="fas fa-arrow-right ml-2"></i>
                    </button>
                  ) : (
                    <button
                      onClick={nextStep}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-sm transition-colors"
                    >
                      <i className="fas fa-paper-plane mr-2"></i>Send Document
                    </button>
                  )}
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
