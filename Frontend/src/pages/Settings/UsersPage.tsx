import { useEffect, useState } from 'react'
import { teamService, roleService } from '@/services/api'
import { toast } from 'react-toastify'
import { Plus, KeyRound, UserX, UserCheck } from 'lucide-react'
import {
  PageHeader, SearchInput, Pagination,
  Modal, ConfirmDialog, Loading, EmptyState, Avatar
} from '@/components/common'
import { useSelector } from 'react-redux'
import { isValidEmail } from '@/utils/format'
import { RootState } from '@/store'

interface AppRole { id: number; name: string }

const EMPTY_FORM = {
  name: '', email: '', password: '', job_title: '', phone: '', role: 'member', app_role_id: '' as string | number,
}

export default function UsersPage() {
  const currentUser = useSelector((s: RootState) => s.auth.user)
  const [users, setUsers] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [appRoles, setAppRoles] = useState<AppRole[]>([])

  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [deactivateId, setDeactivateId] = useState<number | null>(null)

  const [editUser, setEditUser] = useState<any>(null)
  const [form, setForm] = useState<any>(EMPTY_FORM)
  const [editForm, setEditForm] = useState<any>({})
  const [newPassword, setNewPassword] = useState('')
  const [resetUserId, setResetUserId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const LIMIT = 10

  const load = () => {
    setLoading(true)
    teamService.listMembers({ page, limit: LIMIT, q: search })
      .then(r => { setUsers(r.data.data || []); setTotal(r.data.total || 0) })
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [page, search])
  useEffect(() => {
    roleService.list().then(r => setAppRoles(r.data.data || [])).catch(() => {})
  }, [])

  const set = (key: string, val: any) => setForm((f: any) => ({ ...f, [key]: val }))
  const setE = (key: string, val: any) => setEditForm((f: any) => ({ ...f, [key]: val }))

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    if (!form.email.trim()) { toast.error('Email is required'); return }
    if (!isValidEmail(form.email)) { toast.error('Invalid email format'); return }
    if (form.password.length < 6) { toast.error('Password min 6 characters'); return }
    setSaving(true)
    try {
      await teamService.createMember({
        name: form.name,
        email: form.email,
        password: form.password,
        job_title: form.job_title,
        phone: form.phone,
        role: form.role,
        app_role_id: form.role === 'member' && form.app_role_id ? Number(form.app_role_id) : null,
      })
      toast.success(`User ${form.name} created!`)
      setShowAddModal(false)
      setForm(EMPTY_FORM)
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to create user')
    } finally { setSaving(false) }
  }

  const handleEdit = async () => {
    if (!editForm.name?.trim()) { toast.error('Name is required'); return }
    if (editForm.email && !isValidEmail(editForm.email)) { toast.error('Invalid email format'); return }
    setSaving(true)
    try {
      await teamService.updateMember(editUser.id, editForm)
      toast.success('User updated!')
      setShowEditModal(false)
      load()
    } catch { toast.error('Failed to update user') }
    finally { setSaving(false) }
  }

  const handleResetPassword = async () => {
    if (!resetUserId) { toast.error('User not found'); return }
    if (newPassword.length < 6) { toast.error('Password min 6 characters'); return }
    setSaving(true)
    try {
      await teamService.resetPassword(resetUserId!, { password: newPassword })
      toast.success('Password reset successfully!')
      setShowResetModal(false)
      setNewPassword('')
    } catch { toast.error('Failed to reset password') }
    finally { setSaving(false) }
  }

  const handleDeactivate = async () => {
    if (!deactivateId) return
    const target = users.find(u => u.id === deactivateId)
    try {
      await teamService.updateMember(deactivateId, { is_active: !target?.is_active })
      toast.success(target?.is_active ? 'User deactivated' : 'User activated')
      load()
    } catch { toast.error('Failed to update user status') }
  }

  const openEdit = (u: any) => {
    setEditUser(u)
    setEditForm({ name: u.name, email: u.email, job_title: u.job_title || '', phone: u.phone || '', role: u.role, app_role_id: u.app_role_id ?? '' })
    setShowEditModal(true)
  }

  const openReset = (u: any) => {
    setResetUserId(u.id)
    setNewPassword('')
    setShowResetModal(true)
  }

  const roleBadge = (role: string) => (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
      {role}
    </span>
  )

  return (
    <div className="p-5">
      <PageHeader
        title="User Accounts"
        actions={
          <button className="btn btn-primary" onClick={() => { setForm(EMPTY_FORM); setShowAddModal(true) }}>
            <Plus size={12} /> Add user
          </button>
        }
      />

      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">{total} users</p>
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} />
      </div>

      <div className="table-container">
        {loading ? <Loading /> : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Job Title</th>
                  <th>Role</th>
                  <th>App Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0
                  ? <tr><td colSpan={8}><EmptyState /></td></tr>
                  : users.map(u => (
                    <tr key={u.id} className={!u.is_active ? 'opacity-50' : ''}>
                      <td>
                        <div className="flex items-center gap-2">
                          <Avatar name={u.name} />
                          <div>
                            <p className="font-medium text-gray-800">{u.name}</p>
                            {u.id === currentUser?.id && (
                              <span className="text-xs text-blue-500">(you)</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="text-gray-600">{u.email}</td>
                      <td className="text-gray-500">{u.job_title || '-'}</td>
                      <td>{roleBadge(u.role)}</td>
                      <td className="text-gray-500 text-xs">
                        {u.app_role_id ? (appRoles.find(r => r.id === u.app_role_id)?.name ?? `#${u.app_role_id}`) : '-'}
                      </td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-1 flex-wrap">
                          <button
                            className="btn btn-secondary text-xs py-0.5 px-2"
                            onClick={() => openEdit(u)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-secondary text-xs py-0.5 px-2"
                            title="Reset Password"
                            onClick={() => openReset(u)}
                          >
                            <KeyRound size={11} />
                          </button>
                          {u.id !== currentUser?.id && (
                            <button
                              className={`btn text-xs py-0.5 px-2 ${u.is_active ? 'btn-danger' : 'btn-secondary'}`}
                              title={u.is_active ? 'Deactivate' : 'Activate'}
                              onClick={() => setDeactivateId(u.id)}
                            >
                              {u.is_active ? <UserX size={11} /> : <UserCheck size={11} />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
            <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />
          </>
        )}
      </div>

      {/* ── Add User Modal ──────────────────────────────── */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add user"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>{saving ? 'Creating...' : 'Create'}</button>
          </>
        }
      >
        <div className="space-y-3">
          <Row label="Full Name *">
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Full name" />
          </Row>
          <Row label="Email *">
            <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@example.com" />
          </Row>
          <Row label="Password *">
            <input className="input" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min 6 characters" />
          </Row>
          <Row label="Job Title">
            <input className="input" value={form.job_title} onChange={e => set('job_title', e.target.value)} placeholder="e.g. IT Auditor" />
          </Row>
          <Row label="Phone">
            <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+62..." />
          </Row>
          <Row label="Role">
            <select className="input" value={form.role} onChange={e => set('role', e.target.value)}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </Row>
          {form.role === 'member' && (
            <Row label="App Role">
              <select className="input" value={form.app_role_id} onChange={e => set('app_role_id', e.target.value)}>
                <option value="">— No specific role (full access) —</option>
                {appRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Row>
          )}
        </div>
      </Modal>

      {/* ── Edit User Modal ─────────────────────────────── */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit user"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleEdit} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </>
        }
      >
        <div className="space-y-3">
          <Row label="Full Name *">
            <input className="input" value={editForm.name || ''} onChange={e => setE('name', e.target.value)} />
          </Row>
          <Row label="Email">
            <input className="input" type="email" value={editForm.email || ''} onChange={e => setE('email', e.target.value)} />
          </Row>
          <Row label="Job Title">
            <input className="input" value={editForm.job_title || ''} onChange={e => setE('job_title', e.target.value)} />
          </Row>
          <Row label="Phone">
            <input className="input" value={editForm.phone || ''} onChange={e => setE('phone', e.target.value)} />
          </Row>
          <Row label="Role">
            <select className="input" value={editForm.role || 'member'} onChange={e => setE('role', e.target.value)}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </Row>
          {(editForm.role || 'member') === 'member' && (
            <Row label="App Role">
              <select className="input" value={editForm.app_role_id ?? ''} onChange={e => setE('app_role_id', e.target.value ? Number(e.target.value) : null)}>
                <option value="">— No specific role (full access) —</option>
                {appRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Row>
          )}
        </div>
      </Modal>

      {/* ── Reset Password Modal ────────────────────────── */}
      <Modal
        open={showResetModal}
        onClose={() => setShowResetModal(false)}
        title="Reset Password"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowResetModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleResetPassword} disabled={saving}>{saving ? 'Resetting...' : 'Reset'}</button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Set a new password for this user. Min 6 characters.</p>
          <Row label="New Password">
            <input className="input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 6 characters" />
          </Row>
        </div>
      </Modal>

      {/* ── Deactivate Confirm ──────────────────────────── */}
      <ConfirmDialog
        open={!!deactivateId}
        onClose={() => setDeactivateId(null)}
        onConfirm={handleDeactivate}
        message={
          deactivateId
            ? users.find(u => u.id === deactivateId)?.is_active
              ? 'Deactivate this user? They will not be able to login.'
              : 'Activate this user? They will be able to login again.'
            : ''
        }
      />
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-32 text-sm text-gray-600 flex-shrink-0 pt-2">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}
