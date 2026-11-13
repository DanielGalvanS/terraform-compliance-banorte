import { Card, CardHeader, Icon } from '@/shared/ui'
import type { TerraformModule } from '../model'

type ModuleFilterCardProps = {
  modules: TerraformModule[]
  selected: string
  onSelect: (module: string) => void
}

export function ModuleFilterCard({ modules, selected, onSelect }: ModuleFilterCardProps) {
  return (
    <Card className="modules">
      <CardHeader title="Módulos Terraform" subtitle="Selecciona para filtrar" />
      <div className="module-list">
        {modules.map((module) => (
          <button
            key={module.name}
            type="button"
            onClick={() => onSelect(module.name)}
            className={selected === module.name ? 'active' : ''}
          >
            <span className="module-icon">
              <Icon name={module.icon} size={16} />
            </span>
            {module.name}
            <strong>{module.resourceCount}</strong>
          </button>
        ))}
      </div>
    </Card>
  )
}
