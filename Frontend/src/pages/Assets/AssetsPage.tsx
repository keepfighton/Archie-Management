import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Html5Qrcode } from 'html5-qrcode'
import { assetService, assetSettingsService, projectService, teamService, expenseService } from '@/services/api'
import { toast } from 'react-toastify'
import {
  Plus, Filter, FileDown, QrCode, ScanLine, Printer, X, CheckCircle,
  AlertTriangle, Wrench, Package, XCircle,
} from 'lucide-react'
import {
  PageHeader, Toolbar, SearchInput, Pagination,
  Modal, FormField, ConfirmDialog, Loading, EmptyState, PriceInput,
  ViewTabs, DEFAULT_PAGE_LIMIT, rowNumber,
} from '@/components/common'

// ─── Constants ───────────────────────────────────────
const VIEWS = [
  { key: 'assets', label: 'Aset' },
  { key: 'settings', label: 'Master Data' },
]

const MD_TABS = [
  { key: 'category', label: 'Kategori' },
  { key: 'status', label: 'Status' },
  { key: 'condition', label: 'Kondisi' },
]

const CATEGORY_LABELS: Record<string, string> = {
  hardware: 'Hardware', software: 'Software', vehicle: 'Kendaraan',
  furniture: 'Furnitur', office: 'Perlengkapan Kantor', other: 'Lainnya',
}

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  maintenance: 'bg-yellow-100 text-yellow-700',
  disposed: 'bg-gray-100 text-gray-500',
  lost: 'bg-red-100 text-red-700',
}

const STATUS_ICON: Record<string, JSX.Element> = {
  active:      <CheckCircle size={11} />,
  maintenance: <Wrench size={11} />,
  disposed:    <Package size={11} />,
  lost:        <XCircle size={11} />,
}

const CONDITION_STYLE: Record<string, string> = {
  good: 'bg-blue-100 text-blue-700',
  fair: 'bg-orange-100 text-orange-700',
  poor: 'bg-red-100 text-red-700',
}

function formatIDR(val: number) {
  if (!val && val !== 0) return '-'
  return 'IDR ' + Math.round(val).toLocaleString('id-ID')
}

const EMPTY_FORM = {
  asset_code: '', name: '', category: '', brand: '', asset_model: '',
  serial_number: '', barcode: '', purchase_date: '', purchase_price: '',
  depreciation_pct: '0', currency: 'IDR', location: '', condition: '',
  status: '', notes: '', file_url: '',
  assigned_to_id: '', project_id: '', expense_id: '',
}

// ─── QR Modal ────────────────────────────────────────
function QRModal({ asset, onClose }: { asset: any; onClose: () => void }) {
  const handlePrint = () => {
    const svg = document.getElementById('asset-qr-svg')
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><title>QR ${asset.asset_code}</title>
      <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;gap:12px}
      .code{font-size:14px;font-weight:600;letter-spacing:1px}.name{font-size:12px;color:#555}
      @media print{body{margin:0}}</style></head><body>
      ${svgData}
      <div class="code">${asset.asset_code}</div>
      <div class="name">${asset.name}</div>
      <script>window.onload=()=>window.print()</script></body></html>`)
    win.document.close()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-80 flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between w-full">
          <h3 className="font-semibold text-gray-800">QR Code Aset</h3>
          <button className="text-gray-400 hover:text-gray-600" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <QRCodeSVG id="asset-qr-svg" value={asset.asset_code} size={180} level="H" />
        </div>
        <div className="text-center">
          <p className="text-sm font-mono font-bold tracking-widest text-gray-800">{asset.asset_code}</p>
          <p className="text-xs text-gray-500 mt-1">{asset.name}</p>
          {asset.serial_number && <p className="text-xs text-gray-400">S/N: {asset.serial_number}</p>}
        </div>
        <button className="btn btn-primary w-full gap-2" onClick={handlePrint}>
          <Printer size={14} /> Print QR Code
        </button>
      </div>
    </div>
  )
}

// ─── Scanner Modal ────────────────────────────────────
function ScannerModal({ onFound, onClose }: { onFound: (asset: any) => void; onClose: () => void }) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [manualCode, setManualCode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const containerId = 'qr-scanner-container'

  const stopScan = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop() } catch {}
      scannerRef.current = null
    }
    setScanning(false)
  }

  const startScan = async () => {
    setError('')
    try {
      const scanner = new Html5Qrcode(containerId)
      scannerRef.current = scanner
      setScanning(true)
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decodedText) => {
          await scanner.stop()
          setScanning(false)
          lookupCode(decodedText)
        },
        () => {}
      )
    } catch {
      setError('Kamera tidak dapat diakses. Coba input manual.')
      setScanning(false)
    }
  }

  const lookupCode = async (code: string) => {
    try {
      const res = await assetService.scan(code.trim())
      onFound(res.data)
    } catch {
      setError(`Aset dengan kode "${code}" tidak ditemukan.`)
    }
  }

  useEffect(() => { return () => { stopScan() } }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { stopScan(); onClose() }}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-96 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2"><ScanLine size={16} /> Scan QR / Barcode</h3>
          <button className="text-gray-400 hover:text-gray-600" onClick={() => { stopScan(); onClose() }}><X size={18} /></button>
        </div>
        <div id={containerId} className="w-full rounded-lg overflow-hidden bg-gray-900 min-h-[200px]" />
        {!scanning
          ? <button className="btn btn-primary gap-2" onClick={startScan}><ScanLine size={14} /> Mulai Scan Kamera</button>
          : <button className="btn btn-secondary gap-2" onClick={stopScan}><X size={14} /> Stop Scan</button>
        }
        <div className="relative flex items-center gap-2">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">atau ketik manual</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="Asset Code / Barcode / S/N"
            value={manualCode} onChange={e => setManualCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && manualCode.trim() && lookupCode(manualCode)} />
          <button className="btn btn-primary" onClick={() => manualCode.trim() && lookupCode(manualCode)}>Cari</button>
        </div>
        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2 text-sm">
            <AlertTriangle size={14} /> {error}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Asset Detail Modal (hasil scan) ─────────────────
function AssetDetailModal({ asset, onClose }: { asset: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-[440px] flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Detail Aset</h3>
          <button className="text-gray-400 hover:text-gray-600" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="flex gap-4 items-start">
          <div className="p-2 bg-gray-50 rounded-lg border border-gray-200 shrink-0">
            <QRCodeSVG value={asset.asset_code} size={80} level="H" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-base">{asset.name}</p>
            <p className="text-xs font-mono text-blue-600 mt-0.5">{asset.asset_code}</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[asset.status] || 'bg-gray-100 text-gray-600'}`}>
                {STATUS_ICON[asset.status]} {asset.status}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${CONDITION_STYLE[asset.condition] || 'bg-gray-100 text-gray-600'}`}>
                {asset.condition}
              </span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {([
            ['Kategori', CATEGORY_LABELS[asset.category] || asset.category],
            ['Brand / Model', [asset.brand, asset.asset_model].filter(Boolean).join(' / ') || '-'],
            ['Serial Number', asset.serial_number || '-'],
            ['Barcode', asset.barcode || '-'],
            ['Lokasi', asset.location || '-'],
            ['Penanggung Jawab', asset.assigned_to?.name || '-'],
            ['Proyek', asset.project?.title || '-'],
            ['Harga Beli', formatIDR(asset.purchase_price)],
            ['Nilai Saat Ini', formatIDR(asset.current_value)],
          ] as [string, string][]).map(([label, val]) => (
            <div key={label}>
              <p className="text-xs text-gray-400">{label}</p>
              <p className="font-medium text-gray-800">{val}</p>
            </div>
          ))}
        </div>
        {asset.notes && (
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600">
            <span className="font-medium text-gray-700">Catatan: </span>{asset.notes}
          </div>
        )}
        <button className="btn btn-secondary" onClick={onClose}>Tutup</button>
      </div>
    </div>
  )
}

// ─── Master Data Section ──────────────────────────────
function MasterDataSection() {
  const [mdTab, setMdTab] = useState('category')
  const [items, setItems] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', color: '#6366f1' })

  const load = () => {
    assetSettingsService.list(mdTab)
      .then(r => setItems(r.data.data || []))
      .catch(() => {})
  }

  useEffect(() => { load() }, [mdTab])

  const openAdd = () => {
    setEditItem(null)
    setForm({ name: '', description: '', color: '#6366f1' })
    setShowModal(true)
  }

  const openEdit = (item: any) => {
    setEditItem(item)
    setForm({ name: item.name, description: item.description || '', color: item.color || '#6366f1' })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nama wajib diisi'); return }
    setSaving(true)
    try {
      const payload = { ...form, type: mdTab }
      if (editItem) {
        await assetSettingsService.update(editItem.id, payload)
        toast.success('Data diperbarui')
      } else {
        await assetSettingsService.create(payload)
        toast.success('Data ditambahkan')
      }
      setShowModal(false)
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Gagal menyimpan')
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await assetSettingsService.delete(deleteId)
      toast.success('Data dihapus')
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Gagal menghapus')
    } finally { setDeleteId(null) }
  }

  const labelMap: Record<string, string> = {
    category: 'Kategori', status: 'Status', condition: 'Kondisi',
  }

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {MD_TABS.map(t => (
          <button key={t.key} onClick={() => setMdTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              mdTab === t.key
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <button className="btn btn-primary gap-1 mb-1" onClick={openAdd}>
          <Plus size={13} /> Tambah {labelMap[mdTab]}
        </button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th className="w-12">No.</th>
              <th>Nama</th>
              <th>Deskripsi</th>
              <th>Warna</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0
              ? <tr><td colSpan={5}><EmptyState /></td></tr>
              : items.map((item, i) => (
                <tr key={item.id}>
                  <td className="text-gray-400">{i + 1}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded-full shrink-0"
                        style={{ background: item.color || '#6366f1' }} />
                      <span className="font-medium text-gray-900">{item.name}</span>
                    </div>
                  </td>
                  <td className="text-sm text-gray-500">{item.description || '-'}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-5 h-5 rounded border border-gray-200"
                        style={{ background: item.color || '#6366f1' }} />
                      <span className="text-xs font-mono text-gray-400">{item.color || '#6366f1'}</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn btn-secondary text-xs py-0.5 px-2" onClick={() => openEdit(item)}>Edit</button>
                      <button className="btn btn-danger text-xs py-0.5 px-2" onClick={() => setDeleteId(item.id)}>×</button>
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {/* Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)}
        title={editItem ? `Edit ${labelMap[mdTab]}` : `Tambah ${labelMap[mdTab]}`}
        size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <FormField label="Nama *">
            <input className="input" placeholder={`Nama ${labelMap[mdTab]}`}
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </FormField>
          <FormField label="Deskripsi">
            <input className="input" placeholder="Deskripsi singkat (opsional)"
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </FormField>
          <FormField label="Warna">
            <div className="flex items-center gap-3">
              <input type="color" className="w-10 h-9 rounded border border-gray-200 cursor-pointer p-0.5"
                value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} />
              <span className="text-sm font-mono text-gray-500">{form.color}</span>
            </div>
          </FormField>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        message="Hapus data ini? Nilai yang masih dipakai aset tidak bisa dihapus."
        onConfirm={() => { void handleDelete() }}
        onClose={() => setDeleteId(null)}
      />
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────
export default function AssetsPage() {
  const [view, setView] = useState('assets')

  // ── Asset state ──
  const [assets, setAssets] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterCondition, setFilterCondition] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [qrAsset, setQrAsset] = useState<any>(null)
  const [showScanner, setShowScanner] = useState(false)
  const [scannedAsset, setScannedAsset] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [form, setForm] = useState<any>({ ...EMPTY_FORM })

  // ── Master data (dynamic dropdowns) ──
  const [mdCategories, setMdCategories] = useState<string[]>([])
  const [mdStatuses, setMdStatuses]     = useState<string[]>([])
  const [mdConditions, setMdConditions] = useState<string[]>([])

  const categoryNames  = mdCategories
  const statusNames    = mdStatuses
  const conditionNames = mdConditions

  const load = (q = search, pg = page) => {
    setLoading(true)
    const params: any = { page: pg, limit: DEFAULT_PAGE_LIMIT }
    if (q) params.q = q
    if (filterStatus)    params.status    = filterStatus
    if (filterCategory)  params.category  = filterCategory
    if (filterCondition) params.condition = filterCondition
    assetService.list(params)
      .then(r => { setAssets(r.data.data || []); setTotal(r.data.total || 0) })
      .catch(() => { setAssets([]); setTotal(0) })   // silent — tampilkan empty state, bukan toast
      .finally(() => setLoading(false))
  }

  const loadMasterData = () => {
    assetSettingsService.list('category').then(r => setMdCategories((r.data.data || []).map((x: any) => x.name))).catch(() => {})
    assetSettingsService.list('status').then(r => setMdStatuses((r.data.data || []).map((x: any) => x.name))).catch(() => {})
    assetSettingsService.list('condition').then(r => setMdConditions((r.data.data || []).map((x: any) => x.name))).catch(() => {})
  }

  useEffect(() => { load() }, [page, filterStatus, filterCategory, filterCondition])
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(search, 1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    teamService.listMembers({ limit: 999 }).then(r => setMembers(r.data.data || [])).catch(() => {})
    projectService.list({ limit: 999 }).then(r => setProjects(r.data.data || [])).catch(() => {})
    expenseService.list({ limit: 999 }).then(r => setExpenses(r.data.data || [])).catch(() => {})
    loadMasterData()
  }, [])

  const genAssetCode = () => `AST-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`

  const openAdd = () => {
    setEditItem(null)
    setForm({
      ...EMPTY_FORM,
      asset_code: genAssetCode(),
      category:  categoryNames[0]  || '',
      status:    statusNames[0]    || '',
      condition: conditionNames[0] || '',
    })
    setShowModal(true)
  }

  const openEdit = (a: any) => {
    setEditItem(a)
    setForm({
      asset_code:      a.asset_code,
      name:            a.name,
      category:        a.category        || '',
      brand:           a.brand           || '',
      asset_model:     a.asset_model     || '',
      serial_number:   a.serial_number   || '',
      barcode:         a.barcode         || '',
      purchase_date:   a.purchase_date   ? a.purchase_date.split('T')[0] : '',
      purchase_price:  a.purchase_price  || '',
      depreciation_pct: a.depreciation_pct || '0',
      currency:        a.currency        || 'IDR',
      location:        a.location        || '',
      condition:       a.condition       || '',
      status:          a.status          || '',
      notes:           a.notes           || '',
      file_url:        a.file_url        || '',
      assigned_to_id:  a.assigned_to_id  ? String(a.assigned_to_id) : '',
      project_id:      a.project_id      ? String(a.project_id)     : '',
      expense_id:      a.expense_id      ? String(a.expense_id)     : '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nama aset wajib diisi'); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        purchase_price:   Number(form.purchase_price)   || 0,
        depreciation_pct: Number(form.depreciation_pct) || 0,
        assigned_to_id: form.assigned_to_id ? Number(form.assigned_to_id) : null,
        project_id:     form.project_id     ? Number(form.project_id)     : null,
        expense_id:     form.expense_id     ? Number(form.expense_id)     : null,
      }
      if (editItem) { await assetService.update(editItem.id, payload); toast.success('Aset diperbarui') }
      else          { await assetService.create(payload);              toast.success('Aset ditambahkan') }
      setShowModal(false)
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Gagal menyimpan aset')
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try { await assetService.delete(deleteId); toast.success('Aset dihapus'); load() }
    catch (e: any) { toast.error(e?.response?.data?.error || 'Gagal menghapus') }
    finally { setDeleteId(null) }
  }

  const statusCounts: Record<string, number> = {}
  for (const a of assets) {
    statusCounts[a.status] = (statusCounts[a.status] || 0) + 1
  }

  return (
    <div className="p-5">
      <PageHeader
        title="Asset Management"
        actions={
          view === 'assets' ? (
            <>
              <button className="btn btn-secondary gap-1" onClick={() => setShowScanner(true)}>
                <ScanLine size={13} /> Scan
              </button>
              <button className="btn btn-secondary gap-1" onClick={() => assetService.export()}>
                <FileDown size={13} /> Export
              </button>
              <button className="btn btn-primary gap-1" onClick={openAdd}>
                <Plus size={13} /> Tambah Aset
              </button>
            </>
          ) : null
        }
      />

      <ViewTabs tabs={VIEWS} active={view} onChange={setView} />

      {/* ══ TAB MASTER DATA ══ */}
      {view === 'settings' && <MasterDataSection />}

      {/* ══ TAB ASET ══ */}
      {view === 'assets' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Total Aset',       value: total,                                                          color: 'text-gray-900' },
              { label: 'Aktif',            value: statusCounts['active']      || 0,                              color: 'text-green-600' },
              { label: 'Maintenance',      value: statusCounts['maintenance'] || 0,                              color: 'text-yellow-600' },
              { label: 'Disposed / Lost',  value: (statusCounts['disposed'] || 0) + (statusCounts['lost'] || 0), color: 'text-red-500' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-4">
                <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <Toolbar
            left={
              <div className="flex flex-wrap gap-2 items-center">
                <Filter size={13} className="text-gray-400" />
                <select className="input py-1 text-xs" value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setPage(1) }}>
                  <option value="">Semua Kategori</option>
                  {categoryNames.map((c: string) => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
                </select>
                <select className="input py-1 text-xs" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}>
                  <option value="">Semua Status</option>
                  {statusNames.map((s: string) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className="input py-1 text-xs" value={filterCondition} onChange={e => { setFilterCondition(e.target.value); setPage(1) }}>
                  <option value="">Semua Kondisi</option>
                  {conditionNames.map((c: string) => <option key={c} value={c}>{c}</option>)}
                </select>
                {(filterCategory || filterStatus || filterCondition) && (
                  <button className="text-xs text-blue-500 hover:underline"
                    onClick={() => { setFilterCategory(''); setFilterStatus(''); setFilterCondition('') }}>
                    Reset
                  </button>
                )}
              </div>
            }
            right={<SearchInput value={search} onChange={setSearch} />}
          />

          {/* Table */}
          <div className="table-container">
            {loading ? <Loading /> : (
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-12">No.</th>
                    <th>Kode / Nama</th>
                    <th>Kategori</th>
                    <th>S/N & Barcode</th>
                    <th>Lokasi</th>
                    <th>Penanggung Jawab</th>
                    <th className="text-right">Harga Beli</th>
                    <th className="text-right">Nilai Saat Ini</th>
                    <th>Kondisi</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {assets.length === 0
                    ? <tr><td colSpan={11}><EmptyState /></td></tr>
                    : assets.map((a, i) => (
                      <tr key={a.id}>
                        <td className="text-gray-400">{rowNumber(page, i)}</td>
                        <td>
                          <div>
                            <p className="font-medium text-gray-900">{a.name}</p>
                            <p className="text-xs font-mono text-blue-500">{a.asset_code}</p>
                            {(a.brand || a.asset_model) && (
                              <p className="text-xs text-gray-400">{[a.brand, a.asset_model].filter(Boolean).join(' · ')}</p>
                            )}
                          </div>
                        </td>
                        <td><span className="badge badge-blue">{CATEGORY_LABELS[a.category] || a.category || '-'}</span></td>
                        <td>
                          <div className="text-xs text-gray-500 space-y-0.5">
                            {a.serial_number && <div>S/N: {a.serial_number}</div>}
                            {a.barcode && <div>BC: {a.barcode}</div>}
                            {!a.serial_number && !a.barcode && <span className="text-gray-300">-</span>}
                          </div>
                        </td>
                        <td className="text-sm text-gray-600">{a.location || '-'}</td>
                        <td className="text-sm text-gray-600">{a.assigned_to?.name || '-'}</td>
                        <td className="text-right text-sm font-medium">{formatIDR(a.purchase_price)}</td>
                        <td className="text-right text-sm font-medium text-blue-700">{formatIDR(a.current_value)}</td>
                        <td>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${CONDITION_STYLE[a.condition] || 'bg-gray-100 text-gray-600'}`}>
                            {a.condition || '-'}
                          </span>
                        </td>
                        <td>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[a.status] || 'bg-gray-100 text-gray-600'}`}>
                            {STATUS_ICON[a.status]} {a.status || '-'}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button className="btn btn-secondary text-xs py-0.5 px-2 gap-1" onClick={() => setQrAsset(a)} title="QR Code">
                              <QrCode size={11} />
                            </button>
                            <button className="btn btn-secondary text-xs py-0.5 px-2" onClick={() => openEdit(a)}>Edit</button>
                            <button className="btn btn-danger text-xs py-0.5 px-2" onClick={() => setDeleteId(a.id)}>×</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            )}
          </div>

          <Pagination total={total} page={page} limit={DEFAULT_PAGE_LIMIT} onChange={setPage} />

          {/* Add/Edit Modal */}
          <Modal open={showModal} onClose={() => setShowModal(false)}
            title={editItem ? 'Edit Aset' : 'Tambah Aset'} size="lg"
            footer={
              <>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </>
            }
          >
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Kode Aset">
                <input className="input" value={form.asset_code} onChange={e => setForm((f: any) => ({ ...f, asset_code: e.target.value }))} />
              </FormField>
              <FormField label="Nama Aset *">
                <input className="input" placeholder="Nama aset" value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} />
              </FormField>
              <FormField label="Kategori">
                <select className="input" value={form.category} onChange={e => setForm((f: any) => ({ ...f, category: e.target.value }))}>
                  <option value="">— Pilih Kategori —</option>
                  {categoryNames.map((c: string) => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
                </select>
              </FormField>
              <FormField label="Status">
                <select className="input" value={form.status} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}>
                  <option value="">— Pilih Status —</option>
                  {statusNames.map((s: string) => <option key={s} value={s}>{s}</option>)}
                </select>
              </FormField>
              <FormField label="Brand">
                <input className="input" placeholder="e.g. Dell, Toyota" value={form.brand} onChange={e => setForm((f: any) => ({ ...f, brand: e.target.value }))} />
              </FormField>
              <FormField label="Model">
                <input className="input" placeholder="e.g. Latitude 5540" value={form.asset_model} onChange={e => setForm((f: any) => ({ ...f, asset_model: e.target.value }))} />
              </FormField>
              <FormField label="Serial Number">
                <input className="input" placeholder="S/N" value={form.serial_number} onChange={e => setForm((f: any) => ({ ...f, serial_number: e.target.value }))} />
              </FormField>
              <FormField label="Barcode">
                <input className="input" placeholder="Barcode produk" value={form.barcode} onChange={e => setForm((f: any) => ({ ...f, barcode: e.target.value }))} />
              </FormField>
              <FormField label="Tanggal Beli">
                <input className="input" type="date" value={form.purchase_date} onChange={e => setForm((f: any) => ({ ...f, purchase_date: e.target.value }))} />
              </FormField>
              <FormField label="Kondisi">
                <select className="input" value={form.condition} onChange={e => setForm((f: any) => ({ ...f, condition: e.target.value }))}>
                  <option value="">— Pilih Kondisi —</option>
                  {conditionNames.map((c: string) => <option key={c} value={c}>{c}</option>)}
                </select>
              </FormField>
              <FormField label="Harga Beli">
                <PriceInput value={form.purchase_price} onChange={(v: number) => setForm((f: any) => ({ ...f, purchase_price: v }))} />
              </FormField>
              <FormField label="Depresiasi / Tahun (%)">
                <input className="input" type="number" min="0" max="100" step="0.1" placeholder="0"
                  value={form.depreciation_pct} onChange={e => setForm((f: any) => ({ ...f, depreciation_pct: e.target.value }))} />
              </FormField>
              <FormField label="Lokasi">
                <input className="input" placeholder="e.g. Ruang Server Lt.2" value={form.location} onChange={e => setForm((f: any) => ({ ...f, location: e.target.value }))} />
              </FormField>
              <FormField label="Mata Uang">
                <select className="input" value={form.currency} onChange={e => setForm((f: any) => ({ ...f, currency: e.target.value }))}>
                  {['IDR', 'USD', 'EUR', 'SGD'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </FormField>
              <FormField label="Penanggung Jawab">
                <select className="input" value={form.assigned_to_id} onChange={e => setForm((f: any) => ({ ...f, assigned_to_id: e.target.value }))}>
                  <option value="">— Tidak ada —</option>
                  {members.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </FormField>
              <FormField label="Proyek">
                <select className="input" value={form.project_id} onChange={e => setForm((f: any) => ({ ...f, project_id: e.target.value }))}>
                  <option value="">— Tidak ada —</option>
                  {projects.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </FormField>
              <div className="col-span-2">
                <FormField label="Link ke Expense (Pembelian)">
                  <select className="input" value={form.expense_id} onChange={e => setForm((f: any) => ({ ...f, expense_id: e.target.value }))}>
                    <option value="">— Tidak ada —</option>
                    {expenses.map((e: any) => <option key={e.id} value={e.id}>{e.title} — {formatIDR(e.total)}</option>)}
                  </select>
                </FormField>
              </div>
              <div className="col-span-2">
                <FormField label="Catatan">
                  <textarea className="input" rows={2} value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} />
                </FormField>
              </div>
            </div>
          </Modal>

          <ConfirmDialog
            open={deleteId !== null}
            message="Hapus aset ini? Tindakan ini tidak dapat dibatalkan."
            onConfirm={() => { void handleDelete() }}
            onClose={() => setDeleteId(null)}
          />

          {qrAsset && <QRModal asset={qrAsset} onClose={() => setQrAsset(null)} />}

          {showScanner && (
            <ScannerModal
              onFound={asset => { setShowScanner(false); setScannedAsset(asset) }}
              onClose={() => setShowScanner(false)}
            />
          )}

          {scannedAsset && (
            <AssetDetailModal asset={scannedAsset} onClose={() => setScannedAsset(null)} />
          )}
        </>
      )}
    </div>
  )
}
