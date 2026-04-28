import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { authService } from '@/services/api'

export interface Permission {
  menu: string
  can_read: boolean
  can_edit: boolean
}

interface User {
  id: number
  name: string
  email: string
  job_title: string
  phone: string          // present in userPayload — was missing from the type
  role: string
  app_role_id: number | null
  avatar: string
  clocked_in: boolean
}

interface AuthState {
  user: User | null
  token: string | null
  permissions: Permission[] | null  // null = full access (admin or member tanpa AppRole)
  loading: boolean
  error: string | null
}

// Safe JSON.parse — returns null instead of crashing on corrupted storage values.
function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try { return JSON.parse(raw) as T } catch { return null }
}

function clearSessionStorage() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  localStorage.removeItem('permissions')
  sessionStorage.removeItem('token')
  sessionStorage.removeItem('user')
  sessionStorage.removeItem('permissions')
}

const storedToken = localStorage.getItem('token') || sessionStorage.getItem('token')
const storedUser  = localStorage.getItem('user')  || sessionStorage.getItem('user')
const storedPerms = localStorage.getItem('permissions') || sessionStorage.getItem('permissions')

const initialState: AuthState = {
  user:        safeParse<User>(storedUser),
  token:       storedToken || null,
  permissions: safeParse<Permission[]>(storedPerms),
  loading:     false,
  error:       null,
}

function saveSession(token: string, user: User, permissions: Permission[] | null, remember: boolean) {
  const storage = remember ? localStorage : sessionStorage
  const other = remember ? sessionStorage : localStorage
  storage.setItem('token', token)
  storage.setItem('user', JSON.stringify(user))
  storage.setItem('permissions', JSON.stringify(permissions))
  other.removeItem('token')
  other.removeItem('user')
  other.removeItem('permissions')
}

export const login = createAsyncThunk(
  'auth/login',
  async (
    { email, password, remember }: { email: string; password: string; remember: boolean },
    { rejectWithValue }
  ) => {
    try {
      const res = await authService.login(email, password)
      return { ...res.data, remember }
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Login failed')
    }
  }
)

export const fetchMe = createAsyncThunk('auth/me', async (_, { rejectWithValue }) => {
  try {
    const res = await authService.me()
    return res.data as { user: User; permissions: Permission[] | null }
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || 'Failed to fetch user')
  }
})

// Calls the API logout endpoint (so the server can blacklist the JTI) then
// clears local state.  Always falls through to the local clear even if the
// network request fails (e.g. token already expired).
export const logoutAsync = createAsyncThunk(
  'auth/logoutAsync',
  async (_, { dispatch }) => {
    try { await authService.logout() } catch { /* ignore — clear locally anyway */ }
    dispatch(logout())
  }
)

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.user = null
      state.token = null
      state.permissions = null
      clearSessionStorage()
    },
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload
    },
    setPermissions(state, action: PayloadAction<Permission[] | null>) {
      state.permissions = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => { state.loading = true; state.error = null })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false
        state.token = action.payload.token
        state.user = action.payload.user
        state.permissions = action.payload.permissions ?? null
        saveSession(action.payload.token, action.payload.user, state.permissions, action.payload.remember)
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        // Backend /auth/me now returns {user, permissions} — same envelope as Login.
        state.user = action.payload.user
        state.permissions = action.payload.permissions ?? null
        const storage = localStorage.getItem('token') ? localStorage : sessionStorage
        storage.setItem('user', JSON.stringify(action.payload.user))
        storage.setItem('permissions', JSON.stringify(state.permissions))
      })
      .addCase(fetchMe.rejected, (state, action) => {
        state.user = null
        state.token = null
        state.permissions = null
        state.error = action.payload as string
        clearSessionStorage()
      })
  },
})

export const { logout, setUser, setPermissions } = authSlice.actions
export default authSlice.reducer

// ─── Permission Helpers ───────────────────────────────

export function canRead(permissions: Permission[] | null | undefined, role: string | undefined, menu: string): boolean {
  if (!role || role === 'admin') return true
  if (!permissions) return true // null or undefined = full access
  const p = permissions.find(x => x.menu === menu)
  return p?.can_read ?? false
}

export function canEdit(permissions: Permission[] | null | undefined, role: string | undefined, menu: string): boolean {
  if (!role || role === 'admin') return true
  if (!permissions) return true
  const p = permissions.find(x => x.menu === menu)
  return p?.can_edit ?? false
}
