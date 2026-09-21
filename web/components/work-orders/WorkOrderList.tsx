'use client'

import { Fragment, type ReactNode } from 'react'
import type { WorkOrder } from '@/types/database'

export interface WorkOrderListProps {
  workOrders: WorkOrder[]
  children: (workOrder: WorkOrder) => ReactNode
}

export function WorkOrderList({ workOrders, children }: WorkOrderListProps) {
  return (
    <div className="space-y-3">
      {workOrders.map((wo) => (
        <Fragment key={wo.id}>{children(wo)}</Fragment>
      ))}
    </div>
  )
}
