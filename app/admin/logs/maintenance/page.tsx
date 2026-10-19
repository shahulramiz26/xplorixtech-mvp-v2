'use client'

import { ADMIN_NAME } from '../../../../lib/costing-store'
import { MaintenanceLogsScreen } from '../../../components/log-screens'

/* Every maintenance log in the company's record. */
export default function AdminMaintenanceLogs() {
  return <MaintenanceLogsScreen who={ADMIN_NAME} />
}
