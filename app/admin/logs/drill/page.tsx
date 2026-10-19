'use client'

import { ADMIN_NAME } from '../../../../lib/costing-store'
import { DrillLogsScreen } from '../../../components/log-screens'

/* Every drill log in the company's record: the admin can open and change any. */
export default function AdminDrillLogs() {
  return <DrillLogsScreen who={ADMIN_NAME} />
}
