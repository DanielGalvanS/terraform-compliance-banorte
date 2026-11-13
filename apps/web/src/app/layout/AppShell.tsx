import { useNavigation } from '@/shared/navigation'
import { findRoute } from '../routes'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

/** Sidebar + top bar frame; the active route renders inside <main>. */
export function AppShell() {
  const { current } = useNavigation()
  const route = findRoute(current)

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="workspace">
        <Topbar />
        <main>{route?.render()}</main>
      </div>
    </div>
  )
}
