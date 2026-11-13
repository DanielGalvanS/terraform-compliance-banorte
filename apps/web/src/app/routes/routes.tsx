import type { ReactNode } from 'react'
import { AgentPage } from '@/features/agent'
import { ApprovalsPage } from '@/features/approvals'
import { DashboardPage } from '@/features/dashboard'
import { EvidencePage } from '@/features/evidence'
import { ExceptionsPage } from '@/features/exceptions'
import { FindingsPage } from '@/features/findings'
import { InventoryPage } from '@/features/inventory'
import { PerformancePage } from '@/features/performance'
import { PipelinePage } from '@/features/pipeline'
import type { IconName } from '@/shared/ui'

export type Route = {
  id: string
  label: string
  icon: IconName
  /** Pending-items count shown in the sidebar. */
  badge?: number
  render: () => ReactNode
}

/**
 * The single place that knows which pages exist. The sidebar, the breadcrumb
 * and the router all read this list, so adding a page means adding one entry.
 */
export const routes: Route[] = [
  {
    id: 'dashboard',
    label: 'Visión general',
    icon: 'dashboard',
    render: () => <DashboardPage />,
  },
  { id: 'pipeline', label: 'Pipeline', icon: 'pipeline', badge: 3, render: () => <PipelinePage /> },
  { id: 'inventory', label: 'Inventario', icon: 'inventory', render: () => <InventoryPage /> },
  {
    id: 'findings',
    label: 'Hallazgos y drift',
    icon: 'findings',
    badge: 12,
    render: () => <FindingsPage />,
  },
  {
    id: 'exceptions',
    label: 'Excepciones',
    icon: 'shield',
    badge: 2,
    render: () => <ExceptionsPage />,
  },
  {
    id: 'approvals',
    label: 'Aprobaciones',
    icon: 'approvals',
    badge: 2,
    render: () => <ApprovalsPage />,
  },
  { id: 'agent', label: 'Agente de IA', icon: 'agent', render: () => <AgentPage /> },
  {
    id: 'performance',
    label: 'Rendimiento',
    icon: 'performance',
    render: () => <PerformancePage />,
  },
  {
    id: 'evidence',
    label: 'Evidencia y reportes',
    icon: 'evidence',
    render: () => <EvidencePage />,
  },
]

export const defaultRouteId = routes[0]!.id

export function findRoute(id: string): Route | undefined {
  return routes.find((route) => route.id === id)
}

export function isKnownRoute(id: string): boolean {
  return findRoute(id) !== undefined
}
