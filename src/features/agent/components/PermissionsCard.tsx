import { Card, CardHeader, Icon } from '@/shared/ui'
import type { Permission } from '../model'

export function PermissionsCard({ permissions }: { permissions: Permission[] }) {
  return (
    <Card>
      <CardHeader title="Permisos efectivos" subtitle="Principio de mínimo privilegio" />
      <ul className="permission-list">
        {permissions.map((permission) => (
          <li key={permission.text} className={permission.granted ? undefined : 'denied'}>
            <Icon name={permission.granted ? 'check' : 'close'} />
            {permission.text}
          </li>
        ))}
      </ul>
    </Card>
  )
}
