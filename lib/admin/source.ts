/**
 * THE ONE FILE TO CHANGE when wiring the real admin backend.
 *
 * Every admin screen reads through `adminData` (an AdminDataSource,
 * lib/admin/types.ts). Today it is either the local mock (development with
 * NEXT_PUBLIC_ADMIN_MOCKS=true only) or `notConnected`, which tells the
 * screens there is no data source yet. To go live, replace `notConnected`
 * with calls to the admin backend, map its responses onto the types in
 * lib/admin/types.ts, and turn its HTTP errors into AdminDataError with
 * adminErrorKindForStatus (a 403 from the backend's RBAC becomes the
 * "no access" screen). The frontend holds no role logic of its own.
 */

import { ADMIN_MOCKS_ENABLED } from "@/lib/admin-mocks"
import { AdminDataError, type AdminDataSource } from "@/lib/admin/types"

function notConnectedError(): AdminDataError {
  return new AdminDataError("unavailable", "Admin data is not connected yet")
}

const notConnected: AdminDataSource = {
  async getOverview() { throw notConnectedError() },
  async getUsers() { throw notConnectedError() },
  async getWallets() { throw notConnectedError() },
  async getVolume() { throw notConnectedError() },
  async getFiat() { throw notConnectedError() },
  async getAuditLog() { throw notConnectedError() },
  // Nowhere to send it yet; the export itself still works.
  async recordEvent() {},
}

// The mock's import sits behind `process.env.NODE_ENV`, which the bundler
// replaces with a literal at build time: in a production build the branch is
// dead and the mock module isn't bundled at all (not merely never run).
const loadMock: () => Promise<AdminDataSource> =
  process.env.NODE_ENV === "development"
    ? () => import("@/lib/admin/mock").then((m) => m.mockAdminData)
    : () => Promise.reject(notConnectedError())
const mock: AdminDataSource = {
  getOverview: async (period, options) => (await loadMock()).getOverview(period, options),
  getUsers: async (period, query, options) => (await loadMock()).getUsers(period, query, options),
  getWallets: async (period, options) => (await loadMock()).getWallets(period, options),
  getVolume: async (period, options) => (await loadMock()).getVolume(period, options),
  getFiat: async (period, options) => (await loadMock()).getFiat(period, options),
  getAuditLog: async (query, options) => (await loadMock()).getAuditLog(query, options),
  recordEvent: async (event) => (await loadMock()).recordEvent(event),
}

export const adminData: AdminDataSource = ADMIN_MOCKS_ENABLED ? mock : notConnected

/** True while the screens are showing invented figures (they label themselves "Demo data"). */
export const ADMIN_DATA_IS_MOCK = ADMIN_MOCKS_ENABLED
