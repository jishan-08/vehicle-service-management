import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Banknote,
  Calendar,
  Car,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  DollarSign,
  FileCheck,
  FileText,
  Filter,
  Layers,
  Percent,
  Plus,
  Printer,
  QrCode,
  Receipt,
  ReceiptText,
  Search,
  Tag,
  Trash2,
  User as UserIcon,
  Wallet,
  Wrench,
  XCircle,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getApiMessage } from '../utils/error'
import { formatDate, formatMoney } from '../utils/formatters'
import { formatPaymentStatus, formatServiceType } from '../utils/status'
import { listAppointments } from '../services/appointmentService'
import {
  cancelBill,
  createBill,
  listBills,
  recordBillPayment,
} from '../services/billService'
import { listVehicles } from '../services/vehicleService'
import PageHeader from '../components/PageHeader'
import Toolbar from '../components/Toolbar'
import StatusBadge from '../components/StatusBadge'
import StatCard from '../components/StatCard'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'
import Alert from '../components/Alert'
import Modal from '../components/Modal'
import FormField from '../components/FormField'
import ConfirmDialog from '../components/ConfirmDialog'

const PAYMENT_METHODS = [
  { id: 'UPI', label: 'UPI / QR Code', icon: QrCode, description: 'Instant UPI & VPA transfer' },
  { id: 'CARD', label: 'Debit / Credit Card', icon: CreditCard, description: 'POS card terminal payment' },
  { id: 'CASH', label: 'Cash Payment', icon: Banknote, description: 'Physical cash received at counter' },
  { id: 'BANK_TRANSFER', label: 'Bank Transfer (NEFT/IMPS)', icon: Wallet, description: 'Direct bank account remittance' },
]

export default function BillsPage() {
  const { user } = useAuth()
  const [bills, setBills] = useState([])
  const [appointments, setAppointments] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Filters & State
  const [statusFilter, setStatusFilter] = useState('ALL') // 'ALL' | 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED'
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedBillIds, setExpandedBillIds] = useState(new Set())

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [paymentBill, setPaymentBill] = useState(null)
  const [cancellingBill, setCancellingBill] = useState(null)
  const [printingBill, setPrintingBill] = useState(null)

  const canManage = user.role === 'STAFF' || user.role === 'ADMIN'
  const isAdmin = user.role === 'ADMIN'

  // Load Bills, Appointments, and Vehicles
  const loadData = async () => {
    try {
      setError('')
      const requests = [listBills()]
      if (canManage) {
        requests.push(listAppointments().catch(() => ({ data: { data: { appointments: [] } } })))
      }
      requests.push(listVehicles().catch(() => ({ data: { data: { vehicles: [] } } })))

      const [billRes, apptRes, vehRes] = await Promise.all(requests)

      setBills(billRes.data?.data?.bills || [])
      if (apptRes) {
        setAppointments(
          (apptRes.data?.data?.appointments || []).filter(
            (item) => item.status === 'IN_SERVICE' || item.status === 'COMPLETED'
          )
        )
      }
      if (vehRes) {
        setVehicles(vehRes.data?.data?.vehicles || [])
      }
    } catch (err) {
      setError(getApiMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user.role])

  // Vehicle lookup map
  const vehicleMap = useMemo(() => {
    const map = new Map()
    vehicles.forEach((v) => {
      if (v.id) map.set(v.id, v)
    })
    return map
  }, [vehicles])

  // Appointment lookup map
  const appointmentMap = useMemo(() => {
    const map = new Map()
    appointments.forEach((a) => {
      if (a.id) map.set(a.id, a)
    })
    return map
  }, [appointments])

  // Toggle card expansion
  const toggleExpand = (id) => {
    setExpandedBillIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Financial KPI Metrics
  const stats = useMemo(() => {
    let totalInvoiced = 0
    let totalPaid = 0
    let totalDue = 0
    let paidCount = 0
    let pendingCount = 0
    let partialCount = 0
    let cancelledCount = 0

    bills.forEach((b) => {
      if (b.paymentStatus === 'CANCELLED') {
        cancelledCount++
        return
      }
      const total = Number(b.totalAmount) || 0
      const paid = Number(b.amountPaid) || 0
      const due = Math.max(0, total - paid)

      totalInvoiced += total
      totalPaid += paid
      totalDue += due

      if (b.paymentStatus === 'PAID') paidCount++
      else if (b.paymentStatus === 'PARTIALLY_PAID') partialCount++
      else pendingCount++
    })

    return {
      totalInvoiced,
      totalPaid,
      totalDue,
      paidCount,
      pendingCount,
      partialCount,
      cancelledCount,
      allCount: bills.length,
    }
  }, [bills])

  // Filtered Bills
  const filteredBills = useMemo(() => {
    return bills.filter((bill) => {
      // Status Filter
      if (statusFilter !== 'ALL' && bill.paymentStatus !== statusFilter) {
        return false
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const vehicle = bill.vehicleId ? vehicleMap.get(bill.vehicleId) : null
        const vehicleText = vehicle
          ? `${vehicle.make} ${vehicle.model} ${vehicle.registrationNumber}`.toLowerCase()
          : ''
        const appointmentText = bill.appointmentId
          ? `apt-${bill.appointmentId.slice(-6)}`.toLowerCase()
          : ''
        const searchCorpus = `${bill.invoiceNumber} ${bill.paymentStatus} ${bill.paymentMethod || ''} ${bill.notes || ''} ${vehicleText} ${appointmentText} ${bill.totalAmount}`.toLowerCase()
        if (!searchCorpus.includes(q)) return false
      }

      return true
    })
  }, [bills, statusFilter, searchQuery, vehicleMap])

  // Handlers
  const handleCreated = (newBill) => {
    setBills((prev) => [newBill, ...prev])
    setCreateModalOpen(false)
    setSuccessMessage(`Invoice ${newBill.invoiceNumber} created successfully.`)
    setTimeout(() => setSuccessMessage(''), 4000)
  }

  const handlePaid = (updatedBill) => {
    setBills((prev) => prev.map((item) => (item.id === updatedBill.id ? updatedBill : item)))
    setPaymentBill(null)
    setSuccessMessage(`Payment recorded for invoice ${updatedBill.invoiceNumber}.`)
    setTimeout(() => setSuccessMessage(''), 4000)
  }

  const handleCancel = async () => {
    if (!cancellingBill) return
    setError('')
    try {
      const res = await cancelBill(cancellingBill.id)
      const updated = res.data?.data?.bill
      setBills((prev) => prev.map((item) => (item.id === cancellingBill.id ? updated : item)))
      setCancellingBill(null)
      setSuccessMessage(`Invoice ${cancellingBill.invoiceNumber} has been cancelled.`)
      setTimeout(() => setSuccessMessage(''), 4000)
    } catch (err) {
      setError(getApiMessage(err))
    }
  }

  const handlePrint = (bill) => {
    setPrintingBill(bill)
    setTimeout(() => {
      window.print()
    }, 150)
  }

  return (
    <div className="content-page bills-page-container">
      {/* Page Header */}
      <PageHeader
        title="Bills"
        eyebrow="Financial records"
        description="Invoices, payment status, and workshop service charges in one view."
      >
        {canManage && (
          <button
            type="button"
            className="primary-button"
            onClick={() => setCreateModalOpen(true)}
            aria-label="Create bill"
          >
            <Plus size={16} aria-hidden="true" />
            <span>Create bill</span>
          </button>
        )}
      </PageHeader>

      {/* Alerts */}
      {error && <Alert type="danger" message={error} onClose={() => setError('')} />}
      {successMessage && <Alert type="success" message={successMessage} onClose={() => setSuccessMessage('')} />}

      {/* Financial KPI Summary Cards */}
      <section className="stats-grid" aria-label="Financial overview metrics">
        <StatCard
          label="Total Invoiced"
          value={formatMoney(stats.totalInvoiced)}
          icon={ReceiptText}
          tone="navy"
        />
        <StatCard
          label="Outstanding Balance"
          value={formatMoney(stats.totalDue)}
          icon={Clock}
          tone={stats.totalDue > 0 ? 'amber' : 'teal'}
        />
        <StatCard
          label="Collected Revenue"
          value={formatMoney(stats.totalPaid)}
          icon={CheckCircle2}
          tone="teal"
        />
        <StatCard
          label="Settled Invoices"
          value={`${stats.paidCount} / ${stats.allCount}`}
          icon={FileCheck}
          tone="coral"
        />
      </section>

      {/* Filter Status Pills */}
      <section className="service-filter-bar surface" aria-label="Filter invoices by payment status">
        <button
          type="button"
          className={`service-filter-pill ${statusFilter === 'ALL' ? 'is-active' : ''}`}
          onClick={() => setStatusFilter('ALL')}
        >
          All invoices
          <span className="pill-count">{stats.allCount}</span>
        </button>
        <button
          type="button"
          className={`service-filter-pill ${statusFilter === 'PENDING' ? 'is-active' : ''}`}
          onClick={() => setStatusFilter('PENDING')}
        >
          Pending payment
          <span className="pill-count">{stats.pendingCount}</span>
        </button>
        <button
          type="button"
          className={`service-filter-pill ${statusFilter === 'PARTIALLY_PAID' ? 'is-active' : ''}`}
          onClick={() => setStatusFilter('PARTIALLY_PAID')}
        >
          Partially paid
          <span className="pill-count">{stats.partialCount}</span>
        </button>
        <button
          type="button"
          className={`service-filter-pill ${statusFilter === 'PAID' ? 'is-active' : ''}`}
          onClick={() => setStatusFilter('PAID')}
        >
          Paid in full
          <span className="pill-count">{stats.paidCount}</span>
        </button>
        {stats.cancelledCount > 0 && (
          <button
            type="button"
            className={`service-filter-pill ${statusFilter === 'CANCELLED' ? 'is-active' : ''}`}
            onClick={() => setStatusFilter('CANCELLED')}
          >
            Cancelled invoices
            <span className="pill-count">{stats.cancelledCount}</span>
          </button>
        )}
      </section>

      {/* Toolbar Search & Result Count */}
      <Toolbar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search invoice #, vehicle, plate, or amount..."
        resultCount={filteredBills.length}
        resultLabel={filteredBills.length === 1 ? 'invoice' : 'invoices'}
      />

      {/* Bills Feed / Main Content */}
      {loading ? (
        <LoadingState message="Loading financial records & invoices..." />
      ) : filteredBills.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={searchQuery ? 'No matching invoices found' : 'No bills recorded'}
          description={
            searchQuery
              ? 'Try refining your search terms or clearing status filters.'
              : canManage
              ? 'Create an invoice when a vehicle service is in progress or completed.'
              : 'Your workshop service bills and payment receipts will appear here.'
          }
          action={
            canManage && !searchQuery ? (
              <button
                type="button"
                className="primary-button"
                onClick={() => setCreateModalOpen(true)}
              >
                <Plus size={16} aria-hidden="true" />
                <span>Create first bill</span>
              </button>
            ) : null
          }
        />
      ) : (
        <div className="service-feed bill-feed" role="feed" aria-label="Invoices list">
          {filteredBills.map((bill) => renderBillCard(bill))}
        </div>
      )}

      {/* Create Bill Modal */}
      {createModalOpen && (
        <CreateBillModal
          appointments={appointments}
          vehicleMap={vehicleMap}
          onClose={() => setCreateModalOpen(false)}
          onSaved={handleCreated}
        />
      )}

      {/* Payment Recording Modal */}
      {paymentBill && (
        <PaymentModal
          bill={paymentBill}
          onClose={() => setPaymentBill(null)}
          onSaved={handlePaid}
        />
      )}

      {/* Cancel Confirmation Dialog */}
      {cancellingBill && (
        <ConfirmDialog
          title="Cancel Invoice"
          description={`Are you sure you want to cancel invoice ${cancellingBill.invoiceNumber}? This will mark the bill as void. This action cannot be reversed.`}
          confirmLabel="Cancel invoice"
          danger
          onConfirm={handleCancel}
          onCancel={() => setCancellingBill(null)}
        />
      )}

      {/* Hidden Printable Invoice Template for Window.print */}
      {printingBill && renderPrintableTemplate(printingBill)}
    </div>
  )

  /**
   * Render single Invoice / Bill Card
   */
  function renderBillCard(bill) {
    const isExpanded = expandedBillIds.has(bill.id)
    const vehicle = bill.vehicleId ? vehicleMap.get(bill.vehicleId) : null
    const appointment = bill.appointmentId ? appointmentMap.get(bill.appointmentId) : null
    const apptRef = bill.appointmentId ? `APT-${bill.appointmentId.slice(-6).toUpperCase()}` : 'APT-GENERAL'
    const isPaid = bill.paymentStatus === 'PAID'
    const isCancelled = bill.paymentStatus === 'CANCELLED'
    const balanceDue = Math.max(0, bill.totalAmount - (bill.amountPaid || 0))
    const totalServices = (bill.services || []).reduce((sum, item) => sum + item.amount, 0)
    const totalParts = (bill.parts || []).reduce((sum, item) => sum + item.amount, 0)

    const paymentMethodInfo = bill.paymentMethod
      ? PAYMENT_METHODS.find((m) => m.id === bill.paymentMethod)
      : null

    return (
      <article
        key={bill.id}
        className={`service-workflow-card bill-card ${isPaid ? 'is-paid' : ''} ${isCancelled ? 'is-cancelled' : ''}`}
        aria-label={`Invoice ${bill.invoiceNumber}`}
      >
        <div className="service-card-main">
          {/* Header Row */}
          <div className="service-header-row">
            <div className="service-identity">
              {/* Invoice Number Badge */}
              <div
                className="invoice-number-block"
                onClick={() => toggleExpand(bill.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggleExpand(bill.id)
                  }
                }}
                aria-label={`Toggle invoice ${bill.invoiceNumber} details`}
              >
                <Receipt className="invoice-icon" size={18} aria-hidden="true" />
                <strong className="invoice-title">{bill.invoiceNumber}</strong>
              </div>

              <div className="service-titles">
                <div className="service-title-wrap">
                  <span className="job-reference-pill">{apptRef}</span>
                  <span className="invoice-date-pill">
                    <Calendar size={12} aria-hidden="true" />
                    Issued {formatDate(bill.issuedAt)}
                  </span>
                  {bill.dueDate && (
                    <span className="invoice-due-pill">
                      <Clock size={12} aria-hidden="true" />
                      Due {formatDate(bill.dueDate)}
                    </span>
                  )}
                </div>

                <div className="service-vehicle-meta">
                  {vehicle ? (
                    <>
                      <Car size={13} aria-hidden="true" />
                      <strong>
                        {vehicle.make} {vehicle.model}
                      </strong>
                      <span className="plate-pill">{vehicle.registrationNumber}</span>
                    </>
                  ) : (
                    <span>Registered vehicle</span>
                  )}
                  {paymentMethodInfo && (
                    <>
                      <span className="meta-dot" aria-hidden="true">•</span>
                      <span className="payment-method-chip">
                        <paymentMethodInfo.icon size={12} aria-hidden="true" />
                        {paymentMethodInfo.label.split('/')[0].trim()}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Financial Summary & Status */}
            <div className="bill-card-financial-badges">
              <div className="bill-grand-total">
                <span className="total-caption">Total Amount</span>
                <strong className="total-val">{formatMoney(bill.totalAmount)}</strong>
              </div>
              <StatusBadge status={bill.paymentStatus} />
            </div>
          </div>

          {/* Payment Progress Bar */}
          <div className="bill-payment-progress-bar-wrap" aria-hidden="true">
            <div
              className={`bill-payment-progress-fill ${isPaid ? 'fill-paid' : bill.amountPaid > 0 ? 'fill-partial' : ''}`}
              style={{
                width: `${Math.min(100, Math.max(0, bill.totalAmount > 0 ? (bill.amountPaid / bill.totalAmount) * 100 : 0))}%`,
              }}
            />
          </div>

          {/* Amount Breakdown Summary */}
          <div className="bill-card-amounts-summary">
            <div className="amount-col">
              <span className="amount-caption">Labour charges</span>
              <strong>{formatMoney(totalServices)}</strong>
            </div>
            <div className="amount-col">
              <span className="amount-caption">Parts & materials</span>
              <strong>{formatMoney(totalParts)}</strong>
            </div>
            <div className="amount-col">
              <span className="amount-caption">Tax & discount</span>
              <span className="tax-discount-text">
                +{formatMoney(bill.tax)} / -{formatMoney(bill.discount)}
              </span>
            </div>
            <div className="amount-col highlight-col">
              <span className="amount-caption">Amount paid</span>
              <strong className="paid-val">{formatMoney(bill.amountPaid || 0)}</strong>
            </div>
            <div className="amount-col highlight-col balance-col">
              <span className="amount-caption">Balance remaining</span>
              <strong className={`balance-val ${balanceDue > 0 ? 'is-due' : 'is-zero'}`}>
                {formatMoney(balanceDue)}
              </strong>
            </div>
          </div>

          {/* Footer Bar: Actions */}
          <div className="service-footer-bar">
            <div className="bill-status-summary-text">
              {isPaid ? (
                <span className="settled-text">
                  <CheckCircle2 size={14} aria-hidden="true" />
                  Account fully settled
                </span>
              ) : isCancelled ? (
                <span className="cancelled-text">
                  <XCircle size={14} aria-hidden="true" />
                  Invoice cancelled & void
                </span>
              ) : (
                <span className="pending-text">
                  <Clock size={14} aria-hidden="true" />
                  Outstanding: <strong>{formatMoney(balanceDue)}</strong>
                </span>
              )}
            </div>

            <div className="service-action-buttons">
              {/* Print Action */}
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={() => handlePrint(bill)}
                aria-label={`Print invoice ${bill.invoiceNumber}`}
              >
                <Printer size={14} aria-hidden="true" />
                <span>Print invoice</span>
              </button>

              {/* Toggle Details */}
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={() => toggleExpand(bill.id)}
                aria-expanded={isExpanded}
              >
                <FileText size={14} aria-hidden="true" />
                <span>Line items & notes</span>
                {isExpanded ? <ChevronUp size={13} aria-hidden="true" /> : <ChevronDown size={13} aria-hidden="true" />}
              </button>

              {/* Record Payment (Staff / Admin) */}
              {canManage && !isPaid && !isCancelled && (
                <button
                  type="button"
                  className="primary-button compact-button"
                  onClick={() => setPaymentBill(bill)}
                >
                  <Check size={14} aria-hidden="true" />
                  <span>Record payment</span>
                </button>
              )}

              {/* Cancel Bill (Admin only, when 0 payment received) */}
              {isAdmin && !isPaid && !isCancelled && (bill.amountPaid || 0) === 0 && (
                <button
                  type="button"
                  className="secondary-button danger-button compact-button"
                  onClick={() => setCancellingBill(bill)}
                >
                  <XCircle size={14} aria-hidden="true" />
                  <span>Cancel bill</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Expandable Line-Items & Notes Inspection Drawer */}
        {isExpanded && (
          <div className="service-expanded-panel invoice-expanded-panel">
            {/* Service Labour Table */}
            <div className="service-note-card invoice-items-card">
              <strong>Service Labour Items</strong>
              {(bill.services || []).length === 0 ? (
                <p className="empty-sub">No individual labour items listed.</p>
              ) : (
                <ul className="invoice-line-items-list">
                  {bill.services.map((srv, idx) => (
                    <li key={`srv-${idx}`} className="line-item-row">
                      <span className="item-desc">{srv.description}</span>
                      <strong className="item-amt">{formatMoney(srv.amount)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Parts & Materials Table */}
            <div className="service-note-card invoice-items-card">
              <strong>Parts & Materials</strong>
              {(bill.parts || []).length === 0 ? (
                <p className="empty-sub">No spare parts billed on this invoice.</p>
              ) : (
                <ul className="invoice-line-items-list">
                  {bill.parts.map((prt, idx) => (
                    <li key={`prt-${idx}`} className="line-item-row">
                      <span className="item-desc">{prt.description}</span>
                      <strong className="item-amt">{formatMoney(prt.amount)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Accounting Breakdown */}
            <div className="service-note-card invoice-accounting-card">
              <strong>Invoice Calculations</strong>
              <ul className="service-timeline-list">
                <li><span>Subtotal:</span> <strong>{formatMoney(bill.subtotal)}</strong></li>
                <li><span>Tax (GST):</span> <strong>+{formatMoney(bill.tax)}</strong></li>
                <li><span>Discount applied:</span> <strong>-{formatMoney(bill.discount)}</strong></li>
                <li className="grand-total-row"><span>Grand total:</span> <strong>{formatMoney(bill.totalAmount)}</strong></li>
                <li><span>Amount received:</span> <strong className="paid-text">{formatMoney(bill.amountPaid || 0)}</strong></li>
                <li className="balance-due-row"><span>Balance remaining:</span> <strong>{formatMoney(balanceDue)}</strong></li>
              </ul>
            </div>

            {/* Notes & Audit Info */}
            <div className="service-note-card invoice-notes-card">
              <strong>Customer Instructions & Workshop Notes</strong>
              <p>{bill.notes || 'No specific invoice notes recorded.'}</p>
              <div className="appointment-timestamps">
                <small>Invoice ID: {apptRef}</small>
                <small> • Created: {formatDate(bill.createdAt)}</small>
                {bill.updatedAt && <small> • Updated: {formatDate(bill.updatedAt)}</small>}
              </div>
            </div>
          </div>
        )}
      </article>
    )
  }

  /**
   * Render Clean Printable Invoice Sheet
   */
  function renderPrintableTemplate(bill) {
    const vehicle = bill.vehicleId ? vehicleMap.get(bill.vehicleId) : null
    const balanceDue = Math.max(0, bill.totalAmount - (bill.amountPaid || 0))
    const totalServices = (bill.services || []).reduce((sum, item) => sum + item.amount, 0)
    const totalParts = (bill.parts || []).reduce((sum, item) => sum + item.amount, 0)

    return (
      <div className="printable-invoice-sheet" id="printable-invoice">
        <div className="print-header">
          <div className="print-company-info">
            <h2>Vehicle Service Management</h2>
            <p>Workshop Operations & Automotive Service Center</p>
            <p>Support: operations@vsm-workshop.com | Tel: +91 (800) 555-0199</p>
          </div>
          <div className="print-invoice-meta">
            <h1>INVOICE</h1>
            <p><strong>Invoice #:</strong> {bill.invoiceNumber}</p>
            <p><strong>Date:</strong> {formatDate(bill.issuedAt)}</p>
            {bill.dueDate && <p><strong>Due Date:</strong> {formatDate(bill.dueDate)}</p>}
            <p><strong>Status:</strong> {formatPaymentStatus(bill.paymentStatus)}</p>
          </div>
        </div>

        <hr className="print-divider" />

        <div className="print-party-grid">
          <div className="print-party-col">
            <h3>Billed To</h3>
            <p><strong>Customer ID:</strong> {user.name || user.email}</p>
            <p><strong>Account Role:</strong> {user.role}</p>
          </div>
          <div className="print-party-col">
            <h3>Vehicle Serviced</h3>
            {vehicle ? (
              <>
                <p><strong>Vehicle:</strong> {vehicle.make} {vehicle.model} ({vehicle.year || 'N/A'})</p>
                <p><strong>Registration #:</strong> {vehicle.registrationNumber}</p>
                <p><strong>Fuel:</strong> {vehicle.fuelType || 'Petrol'}</p>
              </>
            ) : (
              <p>Registered Customer Vehicle</p>
            )}
          </div>
        </div>

        <table className="print-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Category</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(bill.services || []).map((srv, idx) => (
              <tr key={`ps-${idx}`}>
                <td>{srv.description}</td>
                <td>Labour / Service</td>
                <td className="text-right">{formatMoney(srv.amount)}</td>
              </tr>
            ))}
            {(bill.parts || []).map((prt, idx) => (
              <tr key={`pp-${idx}`}>
                <td>{prt.description}</td>
                <td>Replacement Part</td>
                <td className="text-right">{formatMoney(prt.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="print-totals-grid">
          <div className="print-notes-col">
            <h4>Payment Terms & Notes</h4>
            <p>{bill.notes || 'Payment is due upon receipt. All parts carry a standard 90-day workshop warranty.'}</p>
            {bill.paymentMethod && (
              <p><strong>Payment Method:</strong> {bill.paymentMethod}</p>
            )}
          </div>
          <div className="print-calculations-col">
            <div className="calc-row">
              <span>Subtotal:</span>
              <span>{formatMoney(bill.subtotal)}</span>
            </div>
            {bill.discount > 0 && (
              <div className="calc-row">
                <span>Discount:</span>
                <span>-{formatMoney(bill.discount)}</span>
              </div>
            )}
            <div className="calc-row">
              <span>Tax (GST):</span>
              <span>+{formatMoney(bill.tax)}</span>
            </div>
            <div className="calc-row total-row">
              <strong>Grand Total:</strong>
              <strong>{formatMoney(bill.totalAmount)}</strong>
            </div>
            <div className="calc-row">
              <span>Amount Paid:</span>
              <span>{formatMoney(bill.amountPaid || 0)}</span>
            </div>
            <div className="calc-row balance-row">
              <strong>Balance Due:</strong>
              <strong>{formatMoney(balanceDue)}</strong>
            </div>
          </div>
        </div>

        <div className="print-footer">
          <p>Thank you for choosing our Vehicle Service Center. Safe driving!</p>
        </div>
      </div>
    )
  }
}

/**
 * Interactive Multi-Line Invoice Builder Modal
 */
function CreateBillModal({ appointments, vehicleMap, onClose, onSaved }) {
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(appointments[0]?.id || '')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [taxRate, setTaxRate] = useState('18')
  const [discount, setDiscount] = useState('0')

  // Dynamic Service Labour lines
  const [services, setServices] = useState([
    { description: 'Workshop service labour', amount: '150' },
  ])

  // Dynamic Parts lines
  const [parts, setParts] = useState([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Helper calculations for live preview
  const liveSubtotal = useMemo(() => {
    const srvSum = services.reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
    const prtSum = parts.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    return Math.max(0, srvSum + prtSum)
  }, [services, parts])

  const liveDiscount = Math.min(liveSubtotal, Number(discount) || 0)
  const taxableAmount = Math.max(0, liveSubtotal - liveDiscount)
  const liveTax = (taxableAmount * (Number(taxRate) || 0)) / 100
  const liveGrandTotal = Math.max(0, liveSubtotal + liveTax - liveDiscount)

  // Service lines helpers
  const addServiceLine = () => {
    setServices((prev) => [...prev, { description: '', amount: '' }])
  }

  const updateServiceLine = (index, field, value) => {
    setServices((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const removeServiceLine = (index) => {
    setServices((prev) => prev.filter((_, i) => i !== index))
  }

  // Parts lines helpers
  const addPartLine = () => {
    setParts((prev) => [...prev, { description: '', amount: '' }])
  }

  const updatePartLine = (index, field, value) => {
    setParts((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const removePartLine = (index) => {
    setParts((prev) => prev.filter((_, i) => i !== index))
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    // Validate appointment
    if (!selectedAppointmentId) {
      setError('Please select an eligible in-service or completed appointment.')
      setSaving(false)
      return
    }

    // Validate services
    const cleanedServices = services
      .filter((s) => s.description.trim() || Number(s.amount) > 0)
      .map((s) => ({
        description: s.description.trim() || 'Service labour',
        amount: Number(s.amount) || 0,
      }))

    if (cleanedServices.length === 0) {
      setError('Please add at least one service labour item with description and amount.')
      setSaving(false)
      return
    }

    const cleanedParts = parts
      .filter((p) => p.description.trim() || Number(p.amount) > 0)
      .map((p) => ({
        description: p.description.trim() || 'Replacement Part',
        amount: Number(p.amount) || 0,
      }))

    try {
      const payload = {
        appointment: selectedAppointmentId,
        services: cleanedServices,
        parts: cleanedParts,
        taxRate: Number(taxRate) || 0,
        discount: Number(discount) || 0,
        notes: notes.trim(),
        dueDate: dueDate || null,
      }

      const res = await createBill(payload)
      onSaved(res.data?.data?.bill)
    } catch (err) {
      setError(getApiMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Create New Invoice"
      description="Select an in-service appointment and build itemized service labour and spare parts charges."
      onClose={onClose}
    >
      <form className="modal-form bill-modal-form" onSubmit={submit}>
        {error && <Alert type="danger" message={error} />}

        {appointments.length === 0 ? (
          <div className="empty-state compact">
            <strong>No billable appointments available.</strong>
            <span>Only appointments in 'In service' or 'Completed' status can be billed.</span>
          </div>
        ) : (
          <>
            {/* Appointment Selector */}
            <FormField label="Select Billable Appointment" required>
              <select
                value={selectedAppointmentId}
                onChange={(e) => setSelectedAppointmentId(e.target.value)}
                className="form-control"
                required
              >
                {appointments.map((apt) => {
                  const veh = apt.vehicleId ? vehicleMap.get(apt.vehicleId) : null
                  const vehLabel = veh ? `${veh.make} ${veh.model} (${veh.registrationNumber})` : 'Registered Vehicle'
                  const aptRef = `APT-${(apt.id || '').slice(-6).toUpperCase()}`
                  return (
                    <option key={apt.id} value={apt.id}>
                      {aptRef} · {apt.appointmentDate} · {vehLabel} · [{apt.status}]
                    </option>
                  )
                })}
              </select>
            </FormField>

            <div className="field-grid">
              <FormField label="Due Date (Optional)">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="form-control"
                />
              </FormField>

              <FormField label="Tax / GST Rate (%)">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="form-control"
                  placeholder="e.g. 18"
                />
              </FormField>
            </div>

            {/* Service Labour Section */}
            <div className="invoice-builder-section">
              <div className="builder-header">
                <div>
                  <strong>Service Labour Charges</strong>
                  <small>Workshop mechanic & inspection fees</small>
                </div>
                <button
                  type="button"
                  className="secondary-button compact-button"
                  onClick={addServiceLine}
                >
                  <Plus size={13} aria-hidden="true" /> Add labour item
                </button>
              </div>

              <div className="builder-line-items">
                {services.map((srv, idx) => (
                  <div key={idx} className="builder-row">
                    <input
                      type="text"
                      className="form-control item-desc-input"
                      placeholder="Service description (e.g. Oil change labor)"
                      value={srv.description}
                      onChange={(e) => updateServiceLine(idx, 'description', e.target.value)}
                      required
                    />
                    <div className="amount-input-wrap">
                      <span className="currency-prefix">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-control item-amt-input"
                        placeholder="0.00"
                        value={srv.amount}
                        onChange={(e) => updateServiceLine(idx, 'amount', e.target.value)}
                        required
                      />
                    </div>
                    {services.length > 1 && (
                      <button
                        type="button"
                        className="icon-button-danger"
                        onClick={() => removeServiceLine(idx)}
                        aria-label="Remove labour item"
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Parts & Materials Section */}
            <div className="invoice-builder-section">
              <div className="builder-header">
                <div>
                  <strong>Parts & Materials (Optional)</strong>
                  <small>Spare parts, consumables, and fluids</small>
                </div>
                <button
                  type="button"
                  className="secondary-button compact-button"
                  onClick={addPartLine}
                >
                  <Plus size={13} aria-hidden="true" /> Add spare part
                </button>
              </div>

              <div className="builder-line-items">
                {parts.length === 0 ? (
                  <div className="empty-line-notice">No spare parts added. Click "+ Add spare part" if required.</div>
                ) : (
                  parts.map((prt, idx) => (
                    <div key={idx} className="builder-row">
                      <input
                        type="text"
                        className="form-control item-desc-input"
                        placeholder="Part name (e.g. Synthetic Engine Oil 5W-30)"
                        value={prt.description}
                        onChange={(e) => updatePartLine(idx, 'description', e.target.value)}
                      />
                      <div className="amount-input-wrap">
                        <span className="currency-prefix">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="form-control item-amt-input"
                          placeholder="0.00"
                          value={prt.amount}
                          onChange={(e) => updatePartLine(idx, 'amount', e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        className="icon-button-danger"
                        onClick={() => removePartLine(idx)}
                        aria-label="Remove part item"
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Discount & Calculations Live Box */}
            <div className="invoice-live-calc-box">
              <div className="calc-left">
                <FormField label="Discount ($ Amount)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="form-control"
                    placeholder="0.00"
                  />
                </FormField>
              </div>

              <div className="calc-right">
                <div className="calc-summary-line">
                  <span>Subtotal:</span>
                  <strong>{formatMoney(liveSubtotal)}</strong>
                </div>
                <div className="calc-summary-line">
                  <span>Discount:</span>
                  <strong>-{formatMoney(liveDiscount)}</strong>
                </div>
                <div className="calc-summary-line">
                  <span>Tax ({taxRate || 0}%):</span>
                  <strong>+{formatMoney(liveTax)}</strong>
                </div>
                <div className="calc-summary-line grand-total">
                  <span>Estimated Total:</span>
                  <strong>{formatMoney(liveGrandTotal)}</strong>
                </div>
              </div>
            </div>

            {/* Notes */}
            <FormField label="Invoice Notes / Terms">
              <textarea
                rows="2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="form-control"
                placeholder="Payable on vehicle collection. Standard 90-day warranty on replacement parts."
              />
            </FormField>

            {/* Modal Actions */}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="primary-button" disabled={saving}>
                {saving ? 'Creating invoice...' : 'Issue Invoice'}
              </button>
            </div>
          </>
        )}
      </form>
    </Modal>
  )
}

/**
 * Payment Recording Modal
 */
function PaymentModal({ bill, onClose, onSaved }) {
  const outstandingBalance = Math.max(0, bill.totalAmount - (bill.amountPaid || 0))
  const [amount, setAmount] = useState(outstandingBalance.toFixed(2))
  const [method, setMethod] = useState(bill.paymentMethod || 'UPI')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handlePayFull = () => {
    setAmount(outstandingBalance.toFixed(2))
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const numericAmount = Number(amount)
    if (!numericAmount || numericAmount <= 0) {
      setError('Please enter a valid payment amount greater than zero.')
      setSaving(false)
      return
    }

    if (numericAmount > outstandingBalance) {
      setError(`Payment cannot exceed the outstanding balance of ${formatMoney(outstandingBalance)}.`)
      setSaving(false)
      return
    }

    try {
      const res = await recordBillPayment(bill.id, {
        amount: numericAmount,
        paymentMethod: method,
      })
      onSaved(res.data?.data?.bill)
    } catch (err) {
      setError(getApiMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`Record Payment for ${bill.invoiceNumber}`}
      description={`Total: ${formatMoney(bill.totalAmount)} · Already Paid: ${formatMoney(bill.amountPaid || 0)} · Outstanding: ${formatMoney(outstandingBalance)}`}
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={submit}>
        {error && <Alert type="danger" message={error} />}

        {/* Payment Method Selector Grid */}
        <div className="form-group">
          <label className="form-label">Select Payment Method</label>
          <div className="payment-methods-grid" role="radiogroup" aria-label="Payment method">
            {PAYMENT_METHODS.map((m) => {
              const isSelected = method === m.id
              const Icon = m.icon
              return (
                <button
                  type="button"
                  key={m.id}
                  className={`payment-method-card ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => setMethod(m.id)}
                  role="radio"
                  aria-checked={isSelected}
                >
                  <div className="method-icon-wrap">
                    <Icon size={18} aria-hidden="true" />
                  </div>
                  <div className="method-info">
                    <strong>{m.label}</strong>
                    <small>{m.description}</small>
                  </div>
                  {isSelected && <CheckCircle2 size={16} className="method-check" aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Amount Input with Quick-fill Pill */}
        <FormField
          label="Payment Amount Received"
          required
          hint="You can record partial payments or settle the full amount."
        >
          <div className="amount-quick-input-wrap">
            <div className="amount-input-prefix-box">
              <span className="currency-prefix">$</span>
              <input
                type="number"
                min="0.01"
                max={outstandingBalance}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="form-control"
                required
              />
            </div>
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={handlePayFull}
            >
              Pay full balance ({formatMoney(outstandingBalance)})
            </button>
          </div>
        </FormField>

        {/* Actions */}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? 'Recording...' : 'Confirm Payment'}
          </button>
        </div>
      </form>
    </Modal>
  )
}