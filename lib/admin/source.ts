/**
 * THE ONE FILE TO CHANGE when wiring the real admin backend.
 *
 * Every admin screen reads through `adminData` (an AdminDataSource,
 * lib/admin/types.ts). Today it is either the local mock (development with
 * NEXT_PUBLIC_ADMIN_MOCKS=true only) or `notConnected`, which tells the
 * screens there is no data source yet. To go live, replace `notConnected`
 * with calls to the admin backend, map its responses onto AdminOverview /
 * AdminWallets, and turn its HTTP errors into AdminDataError with
 * adminErrorKindForStatus (a 403 from the backend's RBAC becomes the
 * "no access" screen). The frontend holds no role logic of its own.
 */

import { ADMIN_MOCKS_ENABLED } from "@/lib/admin-mocks"
import { AdminDataError, type AdminDataSource } from "@/lib/admin/types"

const notConnected: AdminDataSource = {
  async getOverview() {
    throw new AdminDataError("unavailable", "Admin data is not connected yet")
  },
  async getWallets() {
    throw new AdminDataError("unavailable", "Admin data is not connected yet")
  },
}

// The mock is loaded on demand, behind the gate, so a production bundle never
// executes it.
const mock: AdminDataSource = {
  async getOverview(period, options) {
    const { mockAdminData } = await import("@/lib/admin/mock")
    return mockAdminData.getOverview(period, options)
  },
  async getWallets(period, options) {
    const { mockAdminData } = await import("@/lib/admin/mock")
    return mockAdminData.getWallets(period, options)
  },
}

export const adminData: AdminDataSource = ADMIN_MOCKS_ENABLED ? mock : notConnected

/** True while the screens are showing invented figures (they label themselves "Demo data"). */
export const ADMIN_DATA_IS_MOCK = ADMIN_MOCKS_ENABLED
