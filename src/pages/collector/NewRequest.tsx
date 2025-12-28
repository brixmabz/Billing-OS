import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import { requestsAPI, clientsAPI, type CreateRequestData, type RequestType as APIRequestType, type Client } from '../../api';
import { useMutation } from '../../hooks/useApi';

type RequestType =
  | ''
  // Category 1: Insurance / Billing
  | 'insurance_coverage_claim'
  | 'wrong_insurance_refile'
  | 'auto_accident_3rd_party'
  | 'medicaid_medicare_question'
  // Category 2: Payment
  | 'paid_direct_to_provider'
  | 'on_payment_plan'
  | 'payment_posted_wrong'
  // Category 3: Identity / Validity
  | 'not_our_patient'
  | 'identity_theft_fraud'
  // Category 4: Documentation
  | 'itemized_bill_request'
  | 'validation_package_request'
  | 'statement_resend'
  // Category 5: Charge Dispute
  | 'overcharged_balance_incorrect'
  | 'service_cancelled_not_billed';

// Documentation types can be auto-generated internally per PRD
const AUTO_RESOLVE_TYPES = ['itemized_bill_request', 'statement_resend'];

// PHI Detection patterns
const PHI_PATTERNS = [
  /\b(john|jane|mike|mary|david|sarah|james|emily|robert|jennifer|william|linda|michael|elizabeth)\s+(smith|johnson|williams|brown|jones|garcia|miller|davis|rodriguez|martinez|hernandez|lopez|gonzalez|wilson|anderson|thomas|taylor|moore|jackson|martin|lee|perez|white|harris|sanchez|clark|lewis|robinson|walker|young|allen|king|wright|scott|torres|nguyen|hill|flores|green|adams|nelson|baker|hall|rivera|campbell|mitchell|carter|roberts)\b/gi,
  /\b\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}\b/g, // Date patterns
  /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g, // SSN patterns
  /\b(dob|date of birth|birthday|born on)\b/gi
];

// Default account context (client will be selected from dropdown)
const defaultAccountContext = {
  accountNumber: '12345-6789',
  balance: '$450.00',
  fileId: 'MSB-98765',
  agencyId: 'MSB' as const,
};

// Required fields configuration per request type (from EPIC PRD Section 5)
const REQUIRED_FIELDS_CONFIG: Record<string, string[]> = {
  // Category 1: Insurance / Billing
  insurance_coverage_claim: ['payerName', 'policyIdProvided', 'coverageType'],
  wrong_insurance_refile: ['currentPayer', 'correctPayer', 'refileReason'],
  auto_accident_3rd_party: ['accidentDate', 'insuranceCarrier', 'claimNumber'],
  medicaid_medicare_question: ['coverageType', 'eligibilityDates'],
  // Category 2: Payment
  paid_direct_to_provider: ['paymentMethod', 'paymentDate', 'paymentAmount', 'proofOffered'],
  on_payment_plan: ['planStartDate', 'monthlyAmount', 'providerContact'],
  payment_posted_wrong: ['paymentDate', 'paymentAmount', 'wherePosted', 'whereShouldBe'],
  // Category 3: Identity / Validity
  not_our_patient: ['idVerificationStatus', 'debtorClaim'],
  identity_theft_fraud: ['idVerificationStatus', 'fraudAffidavitOffered'],
  // Category 4: Documentation
  itemized_bill_request: ['deliveryPreference'],
  validation_package_request: ['deliveryPreference', 'requestReason'],
  statement_resend: ['deliveryPreference', 'addressVerified'],
  // Category 5: Charge Dispute
  overcharged_balance_incorrect: ['disputeType', 'expectedBalance'],
  service_cancelled_not_billed: ['cancellationDate', 'cancellationReason', 'referenceNumber'],
};

export default function NewRequest() {
  const navigate = useNavigate();
  const [requestType, setRequestType] = useState<RequestType>('');
  const [notes, setNotes] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [shake, setShake] = useState(false);
  const [createdRequestId, setCreatedRequestId] = useState<string>('');
  const [apiError, setApiError] = useState<string>('');

  // Client selection state
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState<string>('');

  // Fetch clients on mount
  useEffect(() => {
    const fetchClients = async () => {
      try {
        setClientsLoading(true);
        const data = await clientsAPI.getAllClients();
        setClients(data);
        // Auto-select first client if available
        if (data.length > 0) {
          setSelectedClientId(data[0].id);
        }
      } catch (err) {
        setClientsError(err instanceof Error ? err.message : 'Failed to load clients');
      } finally {
        setClientsLoading(false);
      }
    };
    fetchClients();
  }, []);

  // ============ Category 1: Insurance / Billing Fields ============
  // Insurance Coverage Claim
  const [payerName, setPayerName] = useState('');
  const [policyIdProvided, setPolicyIdProvided] = useState('');
  const [coverageType, setCoverageType] = useState('');
  // Wrong Insurance / Refile
  const [currentPayer, setCurrentPayer] = useState('');
  const [correctPayer, setCorrectPayer] = useState('');
  const [refileReason, setRefileReason] = useState('');
  // Auto Accident / 3rd Party
  const [accidentDate, setAccidentDate] = useState('');
  const [insuranceCarrier, setInsuranceCarrier] = useState('');
  const [claimNumber, setClaimNumber] = useState('');
  // Medicaid/Medicare Question
  const [eligibilityDates, setEligibilityDates] = useState('');

  // ============ Category 2: Payment Fields ============
  // Paid Direct to Provider
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [proofOffered, setProofOffered] = useState('');
  // On Payment Plan
  const [planStartDate, setPlanStartDate] = useState('');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [providerContact, setProviderContact] = useState('');
  // Payment Posted Wrong
  const [wherePosted, setWherePosted] = useState('');
  const [whereShouldBe, setWhereShouldBe] = useState('');

  // ============ Category 3: Identity / Validity Fields ============
  const [idVerificationStatus, setIdVerificationStatus] = useState('');
  const [debtorClaim, setDebtorClaim] = useState('');
  const [fraudAffidavitOffered, setFraudAffidavitOffered] = useState('');

  // ============ Category 4: Documentation Fields ============
  const [deliveryPreference, setDeliveryPreference] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [addressVerified, setAddressVerified] = useState('');

  // ============ Category 5: Charge Dispute Fields ============
  const [disputeType, setDisputeType] = useState('');
  const [expectedBalance, setExpectedBalance] = useState('');
  const [cancellationDate, setCancellationDate] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');

  // Create request mutation
  const { execute: createRequest, loading: isSubmitting, error: mutationError } = useMutation(
    (data: CreateRequestData) => requestsAPI.createRequest(data)
  );

  // Watch for mutation errors and display them
  useEffect(() => {
    if (mutationError) {
      let errorMessage = 'Failed to create request';

      // Extract message - handle both string and object formats
      const rawMessage = mutationError.message;
      if (typeof rawMessage === 'string') {
        errorMessage = rawMessage;
      } else if (rawMessage && typeof rawMessage === 'object') {
        // Handle object format like {message: "...", existing_request_id: "..."}
        errorMessage = (rawMessage as { message?: string }).message || JSON.stringify(rawMessage);
      }

      // Add context for duplicate errors
      if (mutationError.status === 409 && !errorMessage.includes('duplicate')) {
        errorMessage = `Duplicate request: ${errorMessage}`;
      }

      setApiError(errorMessage);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  }, [mutationError]);

  const isAutoResolve = AUTO_RESOLVE_TYPES.includes(requestType);

  const phiDetected = useMemo(() => {
    if (!notes) return false;
    return PHI_PATTERNS.some(pattern => pattern.test(notes));
  }, [notes]);

  // Get all field values for validation
  const getFieldValue = (fieldName: string): string => {
    const fieldMap: Record<string, string> = {
      payerName, policyIdProvided, coverageType,
      currentPayer, correctPayer, refileReason,
      accidentDate, insuranceCarrier, claimNumber,
      eligibilityDates,
      paymentMethod, paymentDate, paymentAmount, proofOffered,
      planStartDate, monthlyAmount, providerContact,
      wherePosted, whereShouldBe,
      idVerificationStatus, debtorClaim, fraudAffidavitOffered,
      deliveryPreference, requestReason, addressVerified,
      disputeType, expectedBalance,
      cancellationDate, cancellationReason, referenceNumber,
    };
    return fieldMap[fieldName] || '';
  };

  // Validate required fields
  const validateRequiredFields = (): boolean => {
    if (!requestType) return false;
    const requiredFields = REQUIRED_FIELDS_CONFIG[requestType] || [];
    return requiredFields.every(field => getFieldValue(field).trim() !== '');
  };

  const canSubmit = requestType !== '' && selectedClientId !== null && !isSubmitting && !phiDetected && validateRequiredFields();

  // Build required fields payload
  const buildRequiredFieldsPayload = (): Record<string, unknown> => {
    const payload: Record<string, unknown> = {};

    switch (requestType) {
      case 'insurance_coverage_claim':
        payload.payer_name = payerName;
        payload.policy_id_provided = policyIdProvided === 'yes';
        payload.coverage_type = coverageType;
        break;
      case 'wrong_insurance_refile':
        payload.current_payer = currentPayer;
        payload.correct_payer = correctPayer;
        payload.refile_reason = refileReason;
        break;
      case 'auto_accident_3rd_party':
        payload.accident_date = accidentDate;
        payload.insurance_carrier = insuranceCarrier;
        payload.claim_number = claimNumber;
        break;
      case 'medicaid_medicare_question':
        payload.coverage_type = coverageType;
        payload.eligibility_dates_claimed = eligibilityDates;
        break;
      case 'paid_direct_to_provider':
        payload.payment_method = paymentMethod;
        payload.payment_date = paymentDate;
        payload.payment_amount = paymentAmount;
        payload.proof_offered = proofOffered === 'yes';
        break;
      case 'on_payment_plan':
        payload.plan_start_date = planStartDate;
        payload.monthly_amount = monthlyAmount;
        payload.provider_contact = providerContact;
        break;
      case 'payment_posted_wrong':
        payload.payment_date = paymentDate;
        payload.payment_amount = paymentAmount;
        payload.where_posted = wherePosted;
        payload.where_should_be = whereShouldBe;
        break;
      case 'not_our_patient':
        payload.id_verification_status = idVerificationStatus;
        payload.debtor_claim = debtorClaim;
        break;
      case 'identity_theft_fraud':
        payload.id_verification_status = idVerificationStatus;
        payload.fraud_affidavit_offered = fraudAffidavitOffered === 'yes';
        break;
      case 'itemized_bill_request':
        payload.delivery_preference = deliveryPreference;
        break;
      case 'validation_package_request':
        payload.delivery_preference = deliveryPreference;
        payload.request_reason = requestReason;
        break;
      case 'statement_resend':
        payload.delivery_preference = deliveryPreference;
        payload.address_verified = addressVerified === 'yes';
        break;
      case 'overcharged_balance_incorrect':
        payload.dispute_type = disputeType;
        payload.expected_balance = expectedBalance;
        break;
      case 'service_cancelled_not_billed':
        payload.cancellation_date = cancellationDate;
        payload.cancellation_reason = cancellationReason;
        payload.reference_number = referenceNumber;
        break;
    }

    return payload;
  };

  const handleSubmit = async () => {
    if (phiDetected || !validateRequiredFields()) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    if (!requestType || !selectedClientId) return;

    setApiError('');

    const requestData: CreateRequestData = {
      agency_id: defaultAccountContext.agencyId,
      client_id: selectedClientId,
      account_reference: defaultAccountContext.accountNumber,
      internal_file_id: defaultAccountContext.fileId,
      request_type: requestType as APIRequestType,
      required_fields_payload: buildRequiredFieldsPayload(),
      notes: notes || undefined,
    };

    // Execute mutation - errors are handled by useEffect watching mutationError
    const result = await createRequest(requestData);
    if (result) {
      setCreatedRequestId(result.request_id);
      setShowSuccess(true);
    }
  };

  const resetForm = () => {
    setShowSuccess(false);
    setRequestType('');
    setNotes('');
    setCreatedRequestId('');
    setApiError('');
    // Reset all fields
    setPayerName(''); setPolicyIdProvided(''); setCoverageType('');
    setCurrentPayer(''); setCorrectPayer(''); setRefileReason('');
    setAccidentDate(''); setInsuranceCarrier(''); setClaimNumber('');
    setEligibilityDates('');
    setPaymentMethod(''); setPaymentDate(''); setPaymentAmount(''); setProofOffered('');
    setPlanStartDate(''); setMonthlyAmount(''); setProviderContact('');
    setWherePosted(''); setWhereShouldBe('');
    setIdVerificationStatus(''); setDebtorClaim(''); setFraudAffidavitOffered('');
    setDeliveryPreference(''); setRequestReason(''); setAddressVerified('');
    setDisputeType(''); setExpectedBalance('');
    setCancellationDate(''); setCancellationReason(''); setReferenceNumber('');
  };

  // Get missing fields for display
  const getMissingFields = (): string[] => {
    if (!requestType) return [];
    const requiredFields = REQUIRED_FIELDS_CONFIG[requestType] || [];
    return requiredFields.filter(field => !getFieldValue(field).trim());
  };

  const missingFieldsCount = getMissingFields().length;

  // Common input class
  const inputClass = "w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
  const selectClass = "w-full appearance-none bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

  return (
    <div className="bg-slate-100 min-h-screen">
      <Navbar />

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">New Billing Request</h1>
          <p className="text-slate-500 text-sm mt-1">
            Submit a request to Client Services for resolution
          </p>
        </div>

        {/* Widget Card */}
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-xl shadow-xl overflow-hidden relative">
            {/* Widget Header */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center">
                    <i className="fas fa-paper-plane text-white text-sm"></i>
                  </div>
                  <div>
                    <h1 className="text-white font-semibold text-base">Billing Request</h1>
                    <p className="text-slate-400 text-xs">Submit to Client Services</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/collector/requests')}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <i className="fas fa-times text-lg"></i>
                </button>
              </div>
            </div>

            {/* Locked Context Section */}
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Account Context
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-600">
                  <i className="fas fa-lock text-[10px] mr-1"></i>Read-Only
                </span>
              </div>

              {/* Client Error */}
              {clientsError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                  <p className="text-red-700 text-xs">{clientsError}</p>
                </div>
              )}

              {/* Client Selector */}
              <div className="mb-3">
                <label className="block text-[10px] text-slate-400 uppercase tracking-wide mb-1">Client</label>
                {clientsLoading ? (
                  <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5">
                    <p className="text-slate-400 text-sm"><i className="fas fa-spinner fa-spin mr-2"></i>Loading clients...</p>
                  </div>
                ) : (
                  <select
                    value={selectedClientId || ''}
                    onChange={(e) => setSelectedClientId(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select client...</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.code} - {client.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide">Acct #</span>
                    <i className="fas fa-lock text-slate-300 text-[10px]"></i>
                  </div>
                  <p className="text-slate-700 font-medium text-sm mt-0.5 font-mono">
                    {defaultAccountContext.accountNumber}
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide">Balance</span>
                    <i className="fas fa-lock text-slate-300 text-[10px]"></i>
                  </div>
                  <p className="text-slate-700 font-semibold text-sm mt-0.5">{defaultAccountContext.balance}</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide">File ID</span>
                    <i className="fas fa-lock text-slate-300 text-[10px]"></i>
                  </div>
                  <p className="text-slate-700 font-medium text-sm mt-0.5 font-mono">
                    {defaultAccountContext.fileId}
                  </p>
                </div>
              </div>
            </div>

            {/* Request Form Section */}
            <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* API Error Alert */}
              {apiError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center space-x-3">
                  <i className="fas fa-exclamation-circle text-red-500"></i>
                  <span className="text-red-700 text-sm">{apiError}</span>
                </div>
              )}

              {/* Request Type Dropdown */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Request Type <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={requestType}
                    onChange={(e) => setRequestType(e.target.value as RequestType)}
                    className={selectClass}
                  >
                    <option value="">Select request type...</option>
                    <optgroup label="Insurance / Billing">
                      <option value="insurance_coverage_claim">Insurance Coverage Claim</option>
                      <option value="wrong_insurance_refile">Wrong Insurance / Refile</option>
                      <option value="auto_accident_3rd_party">Auto Accident / 3rd Party</option>
                      <option value="medicaid_medicare_question">Medicaid/Medicare Question</option>
                    </optgroup>
                    <optgroup label="Payment">
                      <option value="paid_direct_to_provider">Paid Direct to Provider</option>
                      <option value="on_payment_plan">On Payment Plan</option>
                      <option value="payment_posted_wrong">Payment Posted Wrong</option>
                    </optgroup>
                    <optgroup label="Identity / Validity">
                      <option value="not_our_patient">Not Our Patient</option>
                      <option value="identity_theft_fraud">Identity Theft / Fraud</option>
                    </optgroup>
                    <optgroup label="Documentation">
                      <option value="itemized_bill_request">Itemized Bill Request</option>
                      <option value="validation_package_request">Validation Package Request</option>
                      <option value="statement_resend">Statement Resend</option>
                    </optgroup>
                    <optgroup label="Charge Dispute">
                      <option value="overcharged_balance_incorrect">Overcharged / Balance Incorrect</option>
                      <option value="service_cancelled_not_billed">Service Cancelled / Not Billed</option>
                    </optgroup>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <i className="fas fa-chevron-down text-slate-400 text-sm"></i>
                  </div>
                </div>
              </div>

              {/* Auto-Resolve Alert */}
              {isAutoResolve && (
                <div className="animate-slideDown">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                        <i className="fas fa-bolt text-emerald-600 text-sm"></i>
                      </div>
                      <div>
                        <h4 className="text-emerald-800 font-semibold text-sm">
                          Automated Internal Action
                        </h4>
                        <p className="text-emerald-700 text-sm mt-1">
                          Document will be generated and sent to debtor. No client action required.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic Required Fields based on Request Type */}
              {requestType && (
                <div className="animate-slideDown space-y-4">
                  {/* Details Required Alert */}
                  {!isAutoResolve && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                          <i className="fas fa-exclamation-triangle text-amber-600 text-sm"></i>
                        </div>
                        <div>
                          <h4 className="text-amber-800 font-semibold text-sm">Details Required</h4>
                          <p className="text-amber-700 text-xs">
                            Complete all required fields for client review.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ============ INSURANCE COVERAGE CLAIM ============ */}
                  {requestType === 'insurance_coverage_claim' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Payer Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={payerName}
                          onChange={(e) => setPayerName(e.target.value)}
                          placeholder="e.g., BlueCross BlueShield"
                          className={inputClass}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Policy ID Provided? <span className="text-red-500">*</span>
                          </label>
                          <select value={policyIdProvided} onChange={(e) => setPolicyIdProvided(e.target.value)} className={selectClass}>
                            <option value="">Select...</option>
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Coverage Type <span className="text-red-500">*</span>
                          </label>
                          <select value={coverageType} onChange={(e) => setCoverageType(e.target.value)} className={selectClass}>
                            <option value="">Select...</option>
                            <option value="primary">Primary</option>
                            <option value="secondary">Secondary</option>
                            <option value="unknown">Unknown</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ============ WRONG INSURANCE / REFILE ============ */}
                  {requestType === 'wrong_insurance_refile' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Current Payer <span className="text-red-500">*</span>
                        </label>
                        <input type="text" value={currentPayer} onChange={(e) => setCurrentPayer(e.target.value)} placeholder="Current insurance payer" className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Correct Payer <span className="text-red-500">*</span>
                        </label>
                        <input type="text" value={correctPayer} onChange={(e) => setCorrectPayer(e.target.value)} placeholder="Correct insurance payer" className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Reason for Refile <span className="text-red-500">*</span>
                        </label>
                        <select value={refileReason} onChange={(e) => setRefileReason(e.target.value)} className={selectClass}>
                          <option value="">Select reason...</option>
                          <option value="wrong_payer">Filed to wrong payer</option>
                          <option value="policy_changed">Policy changed</option>
                          <option value="coordination_of_benefits">Coordination of benefits</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* ============ AUTO ACCIDENT / 3RD PARTY ============ */}
                  {requestType === 'auto_accident_3rd_party' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Date of Accident <span className="text-red-500">*</span>
                        </label>
                        <input type="date" value={accidentDate} onChange={(e) => setAccidentDate(e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Insurance Carrier <span className="text-red-500">*</span>
                        </label>
                        <input type="text" value={insuranceCarrier} onChange={(e) => setInsuranceCarrier(e.target.value)} placeholder="Auto insurance carrier name" className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Claim # <span className="text-red-500">*</span>
                        </label>
                        <input type="text" value={claimNumber} onChange={(e) => setClaimNumber(e.target.value)} placeholder="Insurance claim number" className={inputClass} />
                      </div>
                    </div>
                  )}

                  {/* ============ MEDICAID/MEDICARE QUESTION ============ */}
                  {requestType === 'medicaid_medicare_question' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Coverage Type <span className="text-red-500">*</span>
                        </label>
                        <select value={coverageType} onChange={(e) => setCoverageType(e.target.value)} className={selectClass}>
                          <option value="">Select...</option>
                          <option value="medicaid">Medicaid</option>
                          <option value="medicare">Medicare</option>
                          <option value="both">Both</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Eligibility Dates Claimed <span className="text-red-500">*</span>
                        </label>
                        <input type="text" value={eligibilityDates} onChange={(e) => setEligibilityDates(e.target.value)} placeholder="e.g., Jan 2024 - Present" className={inputClass} />
                      </div>
                    </div>
                  )}

                  {/* ============ PAID DIRECT TO PROVIDER ============ */}
                  {requestType === 'paid_direct_to_provider' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Payment Method <span className="text-red-500">*</span>
                          </label>
                          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={selectClass}>
                            <option value="">Select...</option>
                            <option value="cash">Cash</option>
                            <option value="check">Check</option>
                            <option value="credit_card">Credit Card</option>
                            <option value="debit_card">Debit Card</option>
                            <option value="money_order">Money Order</option>
                            <option value="online">Online Payment</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Payment Date <span className="text-red-500">*</span>
                          </label>
                          <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className={inputClass} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Payment Amount <span className="text-red-500">*</span>
                          </label>
                          <input type="text" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="$0.00" className={inputClass} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Proof Offered? <span className="text-red-500">*</span>
                          </label>
                          <select value={proofOffered} onChange={(e) => setProofOffered(e.target.value)} className={selectClass}>
                            <option value="">Select...</option>
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ============ ON PAYMENT PLAN ============ */}
                  {requestType === 'on_payment_plan' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Plan Start Date <span className="text-red-500">*</span>
                          </label>
                          <input type="date" value={planStartDate} onChange={(e) => setPlanStartDate(e.target.value)} className={inputClass} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Monthly Amount <span className="text-red-500">*</span>
                          </label>
                          <input type="text" value={monthlyAmount} onChange={(e) => setMonthlyAmount(e.target.value)} placeholder="$0.00" className={inputClass} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Provider Contact <span className="text-red-500">*</span>
                        </label>
                        <input type="text" value={providerContact} onChange={(e) => setProviderContact(e.target.value)} placeholder="Contact name or phone at provider" className={inputClass} />
                      </div>
                    </div>
                  )}

                  {/* ============ PAYMENT POSTED WRONG ============ */}
                  {requestType === 'payment_posted_wrong' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Payment Date <span className="text-red-500">*</span>
                          </label>
                          <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className={inputClass} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Payment Amount <span className="text-red-500">*</span>
                          </label>
                          <input type="text" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="$0.00" className={inputClass} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Where Payment Posted <span className="text-red-500">*</span>
                        </label>
                        <input type="text" value={wherePosted} onChange={(e) => setWherePosted(e.target.value)} placeholder="Account/location where it posted" className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Where Should Be <span className="text-red-500">*</span>
                        </label>
                        <input type="text" value={whereShouldBe} onChange={(e) => setWhereShouldBe(e.target.value)} placeholder="Correct account/location" className={inputClass} />
                      </div>
                    </div>
                  )}

                  {/* ============ NOT OUR PATIENT ============ */}
                  {requestType === 'not_our_patient' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          ID Verification Status <span className="text-red-500">*</span>
                        </label>
                        <select value={idVerificationStatus} onChange={(e) => setIdVerificationStatus(e.target.value)} className={selectClass}>
                          <option value="">Select...</option>
                          <option value="verified">Verified - Matches</option>
                          <option value="mismatch">Mismatch Found</option>
                          <option value="unable_to_verify">Unable to Verify</option>
                          <option value="refused">Refused to Verify</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          What Debtor Claimed <span className="text-red-500">*</span>
                        </label>
                        <select value={debtorClaim} onChange={(e) => setDebtorClaim(e.target.value)} className={selectClass}>
                          <option value="">Select...</option>
                          <option value="never_patient">Never was a patient there</option>
                          <option value="wrong_person">Wrong person / Identity confusion</option>
                          <option value="service_elsewhere">Received service elsewhere</option>
                          <option value="no_recollection">No recollection of service</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* ============ IDENTITY THEFT / FRAUD ============ */}
                  {requestType === 'identity_theft_fraud' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          ID Verification Status <span className="text-red-500">*</span>
                        </label>
                        <select value={idVerificationStatus} onChange={(e) => setIdVerificationStatus(e.target.value)} className={selectClass}>
                          <option value="">Select...</option>
                          <option value="verified">Verified - Matches</option>
                          <option value="mismatch">Mismatch Found</option>
                          <option value="unable_to_verify">Unable to Verify</option>
                          <option value="refused">Refused to Verify</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Fraud Affidavit Offered? <span className="text-red-500">*</span>
                        </label>
                        <select value={fraudAffidavitOffered} onChange={(e) => setFraudAffidavitOffered(e.target.value)} className={selectClass}>
                          <option value="">Select...</option>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* ============ ITEMIZED BILL REQUEST ============ */}
                  {requestType === 'itemized_bill_request' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Delivery Preference <span className="text-red-500">*</span>
                        </label>
                        <select value={deliveryPreference} onChange={(e) => setDeliveryPreference(e.target.value)} className={selectClass}>
                          <option value="">Select...</option>
                          <option value="mail">Mail</option>
                          <option value="email">Email</option>
                          <option value="portal">Portal</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* ============ VALIDATION PACKAGE REQUEST ============ */}
                  {requestType === 'validation_package_request' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Delivery Preference <span className="text-red-500">*</span>
                        </label>
                        <select value={deliveryPreference} onChange={(e) => setDeliveryPreference(e.target.value)} className={selectClass}>
                          <option value="">Select...</option>
                          <option value="mail">Mail</option>
                          <option value="email">Email</option>
                          <option value="portal">Portal</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Reason for Request <span className="text-red-500">*</span>
                        </label>
                        <select value={requestReason} onChange={(e) => setRequestReason(e.target.value)} className={selectClass}>
                          <option value="">Select...</option>
                          <option value="first_contact">First contact - standard validation</option>
                          <option value="disputes_debt">Disputes the debt</option>
                          <option value="attorney_request">Attorney request</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* ============ STATEMENT RESEND ============ */}
                  {requestType === 'statement_resend' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Delivery Preference <span className="text-red-500">*</span>
                        </label>
                        <select value={deliveryPreference} onChange={(e) => setDeliveryPreference(e.target.value)} className={selectClass}>
                          <option value="">Select...</option>
                          <option value="mail">Mail</option>
                          <option value="email">Email</option>
                          <option value="portal">Portal</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Address Verified? <span className="text-red-500">*</span>
                        </label>
                        <select value={addressVerified} onChange={(e) => setAddressVerified(e.target.value)} className={selectClass}>
                          <option value="">Select...</option>
                          <option value="yes">Yes - Address confirmed</option>
                          <option value="no">No - Needs verification</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* ============ OVERCHARGED / BALANCE INCORRECT ============ */}
                  {requestType === 'overcharged_balance_incorrect' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          What is Disputed? <span className="text-red-500">*</span>
                        </label>
                        <select value={disputeType} onChange={(e) => setDisputeType(e.target.value)} className={selectClass}>
                          <option value="">Select...</option>
                          <option value="service">Service - wrong service billed</option>
                          <option value="amount">Amount - charge is incorrect</option>
                          <option value="coding">Coding - billing code error</option>
                          <option value="duplicate">Duplicate charge</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Expected Balance <span className="text-red-500">*</span>
                        </label>
                        <input type="text" value={expectedBalance} onChange={(e) => setExpectedBalance(e.target.value)} placeholder="$0.00 or description" className={inputClass} />
                      </div>
                    </div>
                  )}

                  {/* ============ SERVICE CANCELLED / NOT BILLED ============ */}
                  {requestType === 'service_cancelled_not_billed' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Cancellation Date <span className="text-red-500">*</span>
                        </label>
                        <input type="date" value={cancellationDate} onChange={(e) => setCancellationDate(e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Cancellation Reason <span className="text-red-500">*</span>
                        </label>
                        <select value={cancellationReason} onChange={(e) => setCancellationReason(e.target.value)} className={selectClass}>
                          <option value="">Select...</option>
                          <option value="patient_cancelled">Patient cancelled</option>
                          <option value="provider_cancelled">Provider cancelled</option>
                          <option value="no_show">No show / Never happened</option>
                          <option value="rescheduled">Rescheduled</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Reference # <span className="text-red-500">*</span>
                        </label>
                        <input type="text" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder="Cancellation confirmation #" className={inputClass} />
                      </div>
                    </div>
                  )}

                  {/* Collector Notes - Always shown when request type selected */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Collector Notes <span className="text-slate-400 text-xs">(Optional)</span>
                    </label>
                    <div className="relative">
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        placeholder="Additional details from the call..."
                        className={`${inputClass} resize-none ${phiDetected ? 'border-red-400 animate-pulseBorder' : ''} ${shake ? 'animate-shake' : ''}`}
                      ></textarea>
                    </div>
                    {/* PHI Warning */}
                    {phiDetected && (
                      <div className="mt-2 animate-slideDown">
                        <div className="bg-red-50 border border-red-300 rounded-lg px-3 py-2 flex items-center space-x-2">
                          <i className="fas fa-shield-halved text-red-500"></i>
                          <span className="text-red-700 text-xs font-medium">
                            PHI DETECTED: Do not enter patient names, DOBs, or SSNs.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="bg-slate-50 border-t border-slate-200 px-5 py-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => navigate('/collector/requests')}
                  className="text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors"
                >
                  <i className="fas fa-times mr-1"></i> Cancel
                </button>
                <div className="flex items-center space-x-3">
                  {requestType && missingFieldsCount > 0 && (
                    <span className="text-xs text-amber-600">
                      <i className="fas fa-exclamation-circle mr-1"></i>
                      {missingFieldsCount} required field{missingFieldsCount > 1 ? 's' : ''} missing
                    </span>
                  )}
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <i className="fas fa-spinner fa-spin text-xs"></i>
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <i className="fas fa-paper-plane text-xs"></i>
                        <span>{isAutoResolve ? 'Generate & Send' : 'Submit Request'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Success State */}
            {showSuccess && (
              <div className="absolute inset-0 bg-white rounded-xl flex items-center justify-center z-10">
                <div className="text-center px-8">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-check text-emerald-600 text-2xl"></i>
                  </div>
                  <h3 className="text-slate-800 font-semibold text-lg">Request Submitted</h3>
                  <p className="text-slate-500 text-sm mt-2">
                    {createdRequestId} created. Client Services has been notified.
                  </p>
                  <button
                    onClick={resetForm}
                    className="mt-6 text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    <i className="fas fa-plus mr-1"></i> New Request
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        @keyframes pulseBorder {
          0%, 100% { border-color: #ef4444; }
          50% { border-color: #fca5a5; }
        }
        .animate-slideDown { animation: slideDown 0.3s ease-out; }
        .animate-shake { animation: shake 0.5s ease-in-out; }
        .animate-pulseBorder { animation: pulseBorder 1.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
