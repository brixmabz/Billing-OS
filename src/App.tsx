import { useState } from 'react'
import { AlertCircle, CheckCircle, Lock } from 'lucide-react'

function App() {
  const [type, setType] = useState('')
  const [notes, setNotes] = useState('')
  const [result, setResult] = useState(null)

  const handleSubmit = async () => {
    const res = await fetch('http://127.0.0.1:8000/api/submit-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: 'WMC-001', account_num: '12345-6789',
        request_type: type, notes: notes
      })
    })
    const data = await res.json()
    setResult(data.status)
  }

  return (
    <div className="p-10 bg-gray-100 min-h-screen flex justify-center">
      <div className="bg-white p-6 rounded-xl shadow-lg w-96">
        <h1 className="text-xl font-bold mb-4 text-black">Billing Request OS</h1>

        {/* READ-ONLY CONTEXT (Locked Fields) */}
        <div className="bg-gray-100 p-3 rounded mb-4 flex items-center gap-2">
          <Lock size={16} className="text-gray-500"/>
          <div className="text-sm text-gray-600">
            <p><strong>Account:</strong> 12345-6789</p>
            <p><strong>Client:</strong> Wesley Medical Center</p>
          </div>
        </div>

        {/* DROPDOWN */}
        <label className="block text-sm font-bold mb-2 text-black">Request Type</label>
        <select className="w-full border p-2 rounded mb-4 text-black"
          onChange={(e) => setType(e.target.value)}>
          <option value="">Select...</option>
          <option value="PIF Letter">PIF Letter (Auto)</option>
          <option value="SIF Letter">SIF Letter (Auto)</option>
          <option value="Dispute">Dispute (Manual)</option>
        </select>

        {/* GREEN BANNER (Auto-Resolve) */}
        {(type === 'PIF Letter' || type === 'SIF Letter') && (
          <div className="bg-green-100 text-green-800 p-3 rounded mb-4 flex gap-2">
            <CheckCircle size={16}/> Auto-Resolve: Letter will be emailed.
          </div>
        )}

        {/* AMBER BANNER (Manual) */}
        {type === 'Dispute' && (
          <div className="bg-yellow-100 text-yellow-800 p-3 rounded mb-4 flex gap-2">
            <AlertCircle size={16}/> Requires Admin Review.
          </div>
        )}

        {/* NOTES FIELD (only for Dispute) */}
        {type === 'Dispute' && (
          <textarea className="w-full border p-2 rounded mb-4 text-black" rows={3}
            placeholder="Describe the issue..."
            onChange={(e) => setNotes(e.target.value)}/>
        )}

        <button onClick={handleSubmit} disabled={!type}
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700
            disabled:bg-gray-300 disabled:cursor-not-allowed">
          Submit Request
        </button>

        {result && (
          <p className="mt-4 text-center font-bold
            ${result === 'CLOSED' ? 'text-green-600' : 'text-yellow-600'}">
            Status: {result}
          </p>
        )}
      </div>
    </div>
  )
}
export default App
