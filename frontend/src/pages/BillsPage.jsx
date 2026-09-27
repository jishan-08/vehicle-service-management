import { useEffect, useState } from 'react'
import { Check, ChevronDown, FileText, Plus, ReceiptText, Search } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getApiMessage } from '../utils/error'
import { formatDate, formatMoney } from '../utils/formatters'
import { listAppointments } from '../services/appointmentService'
import { createBill, listBills, recordBillPayment } from '../services/billService'
import Modal from '../components/Modal'

const emptyDraft = {
  appointment: '',
  serviceDescription: 'Service labour',
  serviceAmount: '',
  partDescription: '',
  partAmount: '',
  taxRate: 0,
  discount: 0,
  notes: '',
}

export default function BillsPage() {
  const { user } = useAuth()
  const [bills, setBills] = useState([])
  const [appointments, setAppointments] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [paymentBill, setPaymentBill] = useState(null)

  const canManage = user.role === 'STAFF' || user.role === 'ADMIN'

  useEffect(() => {
    let active = true
    const requests = [listBills()]
    if (canManage) requests.push(listAppointments())

    Promise.all(requests)
      .then((responses) => {
        if (active) {
          setBills(responses[0].data.data.bills)
          if (responses[1]) {
            setAppointments(
              responses[1].data.data.appointments.filter(
                (item) => item.status === 'IN_SERVICE' || item.status === 'COMPLETED'
              )
            )
          }
        }
      })
      .catch((requestError) => {
        if (active) setError(getApiMessage(requestError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [canManage])

  const filtered = bills.filter((bill) =>
    `${bill.invoiceNumber} ${bill.paymentStatus}`
      .toLowerCase()
      .includes(query.toLowerCase())
  )

  const handleCreated = (bill) => {
    setBills((items) => [bill, ...items])
    setCreateOpen(false)
  }

  const handlePaid = (bill) => {
    setBills((items) => items.map((item) => (item.id === bill.id ? bill : item)))
    setPaymentBill(null)
  }

  return (
    <div className="content-page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Financial records</span>
          <h1>Bills</h1>
          <p>Invoices, payment status, and service charges in one view.</p>
        </div>
        {canManage && (
          <button
            type="button"
            className="primary-button"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={17} aria-hidden="true" /> Create bill
          </button>
        )}
      </section>

      {error && <div className="alert error-alert" role="alert">{error}</div>}

      <section className="toolbar surface">
        <div className="search-field">
          <Search size={17} aria-hidden="true" />
          <input
            placeholder="Search invoice or payment status"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <span className="result-count">{bills.length} invoices</span>
      </section>

      <section className="surface table-surface">
        <div className="table-header">
          <div>
            <span className="eyebrow">Invoice register</span>
            <h2>{user.role === 'CUSTOMER' ? 'Your bills' : 'All bills'}</h2>
          </div>
          <ReceiptText size={21} color="#8b9a9d" aria-hidden="true" />
        </div>

        {loading ? (
          <div className="loading-state">
            <span className="spinner" aria-hidden="true" /> Loading invoices
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <FileText size={23} aria-hidden="true" />
            </div>
            <strong>
              {query ? 'No invoices match that search.' : 'No bills have been issued yet.'}
            </strong>
            <span>
              {canManage
                ? 'Create an invoice when a vehicle is in service.'
                : 'Your invoices will appear here after service billing.'}
            </span>
          </div>
        ) : (
          <div className="bill-list">
            {filtered.map((bill) => {
              const isSelected = selected?.id === bill.id
              const serviceCharges = bill.services.reduce((sum, item) => sum + item.amount, 0)
              const partsCharges = bill.parts.reduce((sum, item) => sum + item.amount, 0)

              return (
                <article
                  className={`bill-row ${isSelected ? 'bill-selected' : ''}`}
                  key={bill.id}
                >
                  <button
                    type="button"
                    className="bill-summary"
                    onClick={() => setSelected(isSelected ? null : bill)}
                    aria-expanded={isSelected}
                  >
                    <span className="bill-icon" aria-hidden="true">
                      <FileText size={18} />
                    </span>
                    <span className="bill-heading">
                      <strong>{bill.invoiceNumber}</strong>
                      <small>Issued {formatDate(bill.issuedAt)}</small>
                    </span>
                    <span className="bill-total">
                      <strong>{formatMoney(bill.totalAmount)}</strong>
                      <small>
                        {bill.amountPaid
                          ? `${formatMoney(bill.amountPaid)} paid`
                          : 'Balance due'}
                      </small>
                    </span>
                    <span className={`payment-badge payment-${bill.paymentStatus.toLowerCase()}`}>
                      {bill.paymentStatus.replace('_', ' ')}
                    </span>
                    <ChevronDown
                      size={17}
                      className={isSelected ? 'rotate-chevron' : ''}
                      aria-hidden="true"
                    />
                  </button>

                  {isSelected && (
                    <div className="bill-details">
                      <div>
                        <span className="detail-label">Service charges</span>
                        <strong>{formatMoney(serviceCharges)}</strong>
                      </div>
                      <div>
                        <span className="detail-label">Parts</span>
                        <strong>{formatMoney(partsCharges)}</strong>
                      </div>
                      <div>
                        <span className="detail-label">Tax</span>
                        <strong>{formatMoney(bill.tax)}</strong>
                      </div>
                      <div>
                        <span className="detail-label">Discount</span>
                        <strong>-{formatMoney(bill.discount)}</strong>
                      </div>

                      <div className="bill-detail-actions">
                        {canManage &&
                          bill.paymentStatus !== 'PAID' &&
                          bill.paymentStatus !== 'CANCELLED' && (
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => setPaymentBill(bill)}
                            >
                              <Check size={15} aria-hidden="true" /> Record payment
                            </button>
                          )}
                        <span className="detail-label">Appointment {bill.appointmentId}</span>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>

      {createOpen && (
        <CreateBillModal
          appointments={appointments}
          onClose={() => setCreateOpen(false)}
          onSaved={handleCreated}
        />
      )}

      {paymentBill && (
        <PaymentModal
          bill={paymentBill}
          onClose={() => setPaymentBill(null)}
          onSaved={handlePaid}
        />
      )}
    </div>
  )
}

function CreateBillModal({ appointments, onClose, onSaved }) {
  const [form, setForm] = useState({
    ...emptyDraft,
    appointment: appointments[0]?.id || '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const serviceAmount = Number(form.serviceAmount)
      const partAmount = form.partAmount === '' ? null : Number(form.partAmount)
      const response = await createBill({
        appointment: form.appointment,
        services: [{ description: form.serviceDescription, amount: serviceAmount }],
        parts: partAmount === null ? [] : [{ description: form.partDescription || 'Parts', amount: partAmount }],
        taxRate: Number(form.taxRate),
        discount: Number(form.discount),
        notes: form.notes,
      })
      onSaved(response.data.data.bill)
    } catch (requestError) {
      setError(getApiMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Create invoice"
      description="The server calculates subtotal, tax, discount, and total."
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={submit}>
        {error && <div className="alert error-alert" role="alert">{error}</div>}

        {appointments.length === 0 ? (
          <div className="empty-state compact">
            <strong>No billable appointments.</strong>
            <span>Only in-service or completed appointments can be billed.</span>
          </div>
        ) : (
          <>
            <label>
              Appointment
              <select
                value={form.appointment}
                onChange={(event) =>
                  setForm({ ...form, appointment: event.target.value })
                }
              >
                {appointments.map((appointment) => (
                  <option key={appointment.id} value={appointment.id}>
                    {appointment.id} · {appointment.status}
                  </option>
                ))}
              </select>
            </label>

            <div className="field-grid">
              <label>
                Service description
                <input
                  required
                  value={form.serviceDescription}
                  onChange={(event) =>
                    setForm({ ...form, serviceDescription: event.target.value })
                  }
                />
              </label>

              <label>
                Service amount
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.serviceAmount}
                  onChange={(event) =>
                    setForm({ ...form, serviceAmount: event.target.value })
                  }
                />
              </label>

              <label>
                Parts description
                <input
                  value={form.partDescription}
                  onChange={(event) =>
                    setForm({ ...form, partDescription: event.target.value })
                  }
                  placeholder="Optional"
                />
              </label>

              <label>
                Parts amount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.partAmount}
                  onChange={(event) =>
                    setForm({ ...form, partAmount: event.target.value })
                  }
                  placeholder="Optional"
                />
              </label>

              <label>
                Tax rate (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.taxRate}
                  onChange={(event) =>
                    setForm({ ...form, taxRate: event.target.value })
                  }
                />
              </label>

              <label>
                Discount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.discount}
                  onChange={(event) =>
                    setForm({ ...form, discount: event.target.value })
                  }
                />
              </label>
            </div>

            <label>
              Notes
              <textarea
                rows="3"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </label>

            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="primary-button" disabled={saving}>
                {saving ? 'Creating...' : 'Create invoice'}
              </button>
            </div>
          </>
        )}
      </form>
    </Modal>
  )
}

function PaymentModal({ bill, onClose, onSaved }) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('CASH')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const outstandingBalance = bill.totalAmount - (bill.amountPaid || 0)

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await recordBillPayment(bill.id, {
        amount: Number(amount),
        paymentMethod: method,
      })
      onSaved(response.data.data.bill)
    } catch (requestError) {
      setError(getApiMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Record payment"
      description={`Outstanding balance: ${formatMoney(outstandingBalance)}`}
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={submit}>
        {error && <div className="alert error-alert" role="alert">{error}</div>}

        <label>
          Payment amount
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>

        <label>
          Payment method
          <select
            value={method}
            onChange={(event) => setMethod(event.target.value)}
          >
            <option value="CASH">CASH</option>
            <option value="CARD">CARD</option>
            <option value="UPI">UPI</option>
            <option value="BANK_TRANSFER">BANK_TRANSFER</option>
          </select>
        </label>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? 'Recording...' : 'Record payment'}
          </button>
        </div>
      </form>
    </Modal>
  )
}