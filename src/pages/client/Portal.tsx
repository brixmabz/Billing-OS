import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { portalAPI } from '../../api';
import type { PortalRequestInfo, PortalUploadResponse } from '../../api/portal';
import type { ResolutionCode } from '../../api/requests';

const actionLabels: Record<string, string> = {
  DEBT_VALID: 'Debt Valid',
  BALANCE_ADJUSTED: 'Balance Adjusted',
  INSURANCE_PAID: 'Insurance Paid',
  PATIENT_PAID: 'Patient Paid',
  ACCOUNT_RECALLED: 'Account Recalled',
  IDENTITY_CONFIRMED_FRAUD: 'Identity Confirmed/Fraud',
  NO_CLIENT_RESPONSE: 'No Response',
  DUPLICATE_CLOSED: 'Duplicate Closed',
  OTHER: 'Other',
};


export default function Portal() {
  const { token } = useParams<{ token: string }>();
  const [showSuccess, setShowSuccess] = useState(false);
  const [resolutionAction, setResolutionAction] = useState<ResolutionCode | ''>('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<PortalUploadResponse[]>([]);
  const [error, setError] = useState(false);
  const [timeLeft, setTimeLeft] = useState(29 * 60 + 42);
  const [requestInfo, setRequestInfo] = useState<PortalRequestInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmationId, setConfirmationId] = useState<string>('');

  // Fetch request info
  const fetchRequestInfo = useCallback(async () => {
    if (!token) {
      setLoadError('Invalid portal link');
      setLoading(false);
      return;
    }

    try {
      const info = await portalAPI.getPortalRequest(token);
      setRequestInfo(info);

      // Calculate time remaining from expires_at
      if (info.expires_at) {
        const expiresAt = new Date(info.expires_at);
        const now = new Date();
        const diffSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
        setTimeLeft(diffSeconds);
      }

      // Check if already responded
      if (info.has_responded) {
        setShowSuccess(true);
      }
    } catch (err) {
      console.error('Failed to fetch portal request:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load request information');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchRequestInfo();
  }, [fetchRequestInfo]);

  // Session timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h ${mins}m`;
    } else {
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && token) {
      const newFiles = Array.from(e.target.files).slice(0, 5 - files.length);
      setFiles((prev) => [...prev, ...newFiles]);

      // Upload files immediately
      setUploading(true);
      for (const file of newFiles) {
        try {
          const uploaded = await portalAPI.uploadDocument(token, file);
          setUploadedFiles((prev) => [...prev, uploaded]);
        } catch (err) {
          console.error('Failed to upload file:', err);
        }
      }
      setUploading(false);
    }
  };

  const removeFile = async (index: number) => {
    if (!token) return;

    const uploadedFile = uploadedFiles[index];
    if (uploadedFile) {
      try {
        await portalAPI.deleteDocument(token, uploadedFile.id);
        setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
      } catch (err) {
        console.error('Failed to delete file:', err);
      }
    }
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!resolutionAction || !token) {
      setError(true);
      setTimeout(() => setError(false), 2000);
      return;
    }

    setSubmitting(true);
    try {
      const response = await portalAPI.submitResponse(token, {
        resolution: resolutionAction,
        notes: notes || undefined,
      });
      setConfirmationId(response.request_id || `CNF-${Date.now()}`);
      setShowSuccess(true);
    } catch (err) {
      console.error('Failed to submit response:', err);
      setError(true);
      setTimeout(() => setError(false), 2000);
    } finally {
      setSubmitting(false);
    }
  };

  const requestId = requestInfo?.request_id || 'REQ-0000';
  const collectorNotes = typeof requestInfo?.details?.notes === 'string' ? requestInfo.details.notes : null;

  // Loading state
  if (loading) {
    return (
      <div className="bg-slate-100 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-3xl text-blue-600 mb-4"></i>
          <p className="text-slate-500">Loading request...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (loadError) {
    return (
      <div className="bg-slate-100 min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-exclamation-triangle text-red-600 text-2xl"></i>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Unable to Load Request</h2>
          <p className="text-slate-500 mb-6">{loadError}</p>
          <p className="text-sm text-slate-400">
            If you believe this is an error, please contact{' '}
            <a href="mailto:clientservices@msbureau.com" className="text-blue-600 hover:underline">
              clientservices@msbureau.com
            </a>
          </p>
        </div>
      </div>
    );
  }

  // Session expired
  if (timeLeft === 0) {
    return (
      <div className="bg-slate-100 min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-clock text-amber-600 text-2xl"></i>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Session Expired</h2>
          <p className="text-slate-500 mb-6">Your session has timed out for security reasons. Please use the original link from your email to start a new session.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-100 min-h-screen flex flex-col">
      {/* Top Security Bar */}
      <div className="bg-slate-800 text-white py-2 px-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <i className="fas fa-shield-halved text-emerald-400"></i>
            <span className="text-sm">Secure Portal</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400 text-sm">256-bit Encryption</span>
          </div>
          <div className="flex items-center space-x-2 text-slate-400 text-sm">
            <i className="fas fa-clock"></i>
            <span>
              Session expires in{' '}
              <span className="text-amber-400 font-medium">{formatTime(timeLeft)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">MSB</span>
              </div>
              <div>
                <h1 className="text-slate-800 font-semibold text-lg">Secure Response Portal</h1>
                <p className="text-slate-500 text-sm">Midwest Service Bureau</p>
              </div>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
                <i className="fas fa-hashtag text-blue-500 mr-2 text-sm"></i>
                <span className="text-blue-700 font-mono font-semibold">{requestId}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl w-full mx-auto px-4 py-8 flex-1">
        {!showSuccess ? (
          <div className="animate-slideUp">
            {/* Request Summary Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
              <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Request Summary</span>
                <span className="text-xs text-slate-500">
                  Received {requestInfo ? new Date(requestInfo.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                </span>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Account Ref</p>
                    <p className="text-slate-800 font-mono font-semibold">{requestInfo?.account_reference || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">File ID</p>
                    <p className="text-slate-800 font-mono font-semibold">{requestInfo?.file_id || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Balance</p>
                    <p className="text-slate-800 font-semibold">{requestInfo?.balance || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Inquiry Type</p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                      {requestInfo?.request_type_display || 'Inquiry'}
                    </span>
                  </div>
                </div>
                {collectorNotes && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Details from Collector</p>
                    <p className="text-slate-700 text-sm whitespace-pre-wrap">
                      {collectorNotes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Response Form */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <i className="fas fa-reply text-white"></i>
                  </div>
                  <div>
                    <h2 className="text-white font-semibold text-lg">Submit Your Response</h2>
                    <p className="text-blue-200 text-sm">Complete the form below to respond to this inquiry</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Resolution Action */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Resolution Action <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={resolutionAction}
                      onChange={(e) => setResolutionAction(e.target.value as ResolutionCode | '')}
                      className={`w-full appearance-none bg-white border rounded-lg px-4 py-3 pr-10 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer text-base ${
                        error ? 'border-red-400 ring-2 ring-red-200' : 'border-slate-300'
                      }`}
                    >
                      <option value="">Select your response...</option>
                      <option value="DEBT_VALID">Debt Valid - Proceed with collection</option>
                      <option value="PATIENT_PAID">Payment Found - Posting to account</option>
                      <option value="INSURANCE_PAID">Insurance Paid - EOB attached</option>
                      <option value="BALANCE_ADJUSTED">Balance Adjusted - See notes</option>
                      <option value="ACCOUNT_RECALLED">Account Recalled - Return to client</option>
                      <option value="OTHER">Other - See notes</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                      <i className="fas fa-chevron-down text-slate-400"></i>
                    </div>
                  </div>
                </div>

                {/* Additional Notes */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Additional Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Provide any additional context for the collector..."
                    className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all"
                  ></textarea>
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Upload Documents</label>
                  <div
                    className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center transition-all cursor-pointer hover:border-blue-400 hover:bg-blue-50/50"
                    onClick={() => document.getElementById('fileInput')?.click()}
                  >
                    {files.length === 0 ? (
                      <>
                        <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <i className="fas fa-cloud-arrow-up text-slate-400 text-2xl"></i>
                        </div>
                        <p className="text-slate-600 font-medium mb-1">Drag & drop files here</p>
                        <p className="text-slate-400 text-sm mb-3">or click to browse</p>
                        <p className="text-xs text-slate-400">EOB, Remittance Advice, Ledger Screenshots, etc.</p>
                        <p className="text-xs text-slate-400 mt-1">PDF, PNG, JPG up to 10MB</p>
                      </>
                    ) : (
                      <div className="space-y-2">
                        {files.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <i className="fas fa-file-pdf text-blue-600"></i>
                              </div>
                              <div className="text-left">
                                <p className="text-slate-700 text-sm font-medium truncate max-w-[200px]">
                                  {file.name}
                                </p>
                                <p className="text-slate-400 text-xs">{(file.size / 1024).toFixed(1)} KB</p>
                              </div>
                            </div>
                            <button
                              onClick={() => removeFile(index)}
                              className="text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <i className="fas fa-times"></i>
                            </button>
                          </div>
                        ))}
                        <button className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium">
                          <i className="fas fa-plus mr-1"></i> Add more files
                        </button>
                      </div>
                    )}
                    <input
                      type="file"
                      id="fileInput"
                      className="hidden"
                      multiple
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={handleFileChange}
                    />
                  </div>
                </div>

                {/* PHI Warning Banner */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <div className="flex items-start space-x-3">
                    <i className="fas fa-triangle-exclamation text-amber-500 mt-0.5"></i>
                    <div>
                      <p className="text-amber-800 text-sm font-medium">HIPAA Reminder</p>
                      <p className="text-amber-700 text-xs mt-0.5">
                        Uploaded documents are transmitted securely. Do not email PHI outside this portal.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || uploading}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-4 rounded-xl font-semibold text-base transition-all flex items-center justify-center space-x-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ boxShadow: '0 4px 14px rgba(59, 130, 246, 0.25)' }}
                  >
                    {submitting ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i>
                        <span>Submitting...</span>
                      </>
                    ) : uploading ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i>
                        <span>Uploading files...</span>
                      </>
                    ) : (
                      <>
                        <i className="fas fa-paper-plane"></i>
                        <span>Submit Response</span>
                      </>
                    )}
                  </button>
                  <p className="text-center text-slate-400 text-xs mt-3">
                    By submitting, you confirm this information is accurate.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-fadeIn">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
              {/* Success Header */}
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 px-8 py-12 text-center">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg animate-checkCircle">
                  <svg className="w-12 h-12" viewBox="0 0 52 52">
                    <path
                      className="animate-checkStroke"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14 27l7 7 16-16"
                    />
                  </svg>
                </div>
                <h2 className="text-white text-2xl font-bold mb-2">Response Submitted!</h2>
                <p className="text-emerald-100">Your response has been securely recorded.</p>
              </div>

              {/* Confirmation Details */}
              <div className="px-8 py-8">
                <div className="bg-slate-50 rounded-xl p-5 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-semibold text-slate-700">Confirmation Details</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                      <i className="fas fa-check-circle mr-1 text-[10px]"></i>Complete
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500 text-xs uppercase tracking-wide mb-0.5">Request ID</p>
                      <p className="text-slate-800 font-mono font-semibold">{requestId}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs uppercase tracking-wide mb-0.5">Confirmation #</p>
                      <p className="text-slate-800 font-mono font-semibold">{confirmationId || `CNF-${Date.now().toString().slice(-5)}`}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs uppercase tracking-wide mb-0.5">Response Type</p>
                      <p className="text-slate-800 font-medium">{actionLabels[resolutionAction] || resolutionAction}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs uppercase tracking-wide mb-0.5">Submitted</p>
                      <p className="text-slate-800 font-medium">
                        {new Date().toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}{' '}
                        {new Date().toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* What Happens Next */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">What Happens Next</h3>
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <i className="fab fa-slack text-blue-600 text-xs"></i>
                      </div>
                      <div>
                        <p className="text-slate-700 text-sm font-medium">Collector Notified via Slack</p>
                        <p className="text-slate-500 text-xs">
                          The assigned collector has received an instant notification.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <i className="fas fa-phone text-emerald-600 text-xs"></i>
                      </div>
                      <div>
                        <p className="text-slate-700 text-sm font-medium">Collection Resumes</p>
                        <p className="text-slate-500 text-xs">
                          The collector will contact the debtor with your updated information.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <i className="fas fa-file-invoice text-slate-600 text-xs"></i>
                      </div>
                      <div>
                        <p className="text-slate-700 text-sm font-medium">Audit Trail Created</p>
                        <p className="text-slate-500 text-xs">
                          This response is permanently logged for compliance records.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => window.print()}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-lg font-medium text-sm transition-all flex items-center justify-center space-x-2"
                  >
                    <i className="fas fa-print"></i>
                    <span>Print Confirmation</span>
                  </button>
                  <button
                    onClick={() => window.close()}
                    className="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-lg font-medium text-sm transition-all flex items-center justify-center space-x-2"
                  >
                    <i className="fas fa-arrow-right-from-bracket"></i>
                    <span>Close Window</span>
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-slate-50 border-t border-slate-200 px-8 py-4 text-center">
                <p className="text-slate-500 text-xs">
                  Questions about this response? Contact{' '}
                  <a href="mailto:clientservices@msbureau.com" className="text-blue-600 hover:underline">
                    clientservices@msbureau.com
                  </a>
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-3xl w-full mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
            <p>© 2024 Midwest Service Bureau. All rights reserved.</p>
            <div className="flex items-center space-x-4 mt-2 sm:mt-0">
              <a href="#" className="hover:text-blue-600">Privacy Policy</a>
              <a href="#" className="hover:text-blue-600">Terms of Service</a>
              <a href="#" className="hover:text-blue-600">Contact</a>
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes checkCircle {
          0% { transform: scale(0); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        @keyframes checkStroke {
          to { stroke-dashoffset: 0; }
        }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out; }
        .animate-slideUp { animation: slideUp 0.5s ease-out; }
        .animate-checkCircle { animation: checkCircle 0.6s ease-out; }
        .animate-checkStroke {
          animation: checkStroke 0.3s ease-out 0.3s forwards;
          stroke-dasharray: 50;
          stroke-dashoffset: 50;
        }
      `}</style>
    </div>
  );
}
