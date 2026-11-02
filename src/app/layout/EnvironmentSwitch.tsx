import { ENVIRONMENTS } from '@/shared/model'
import { useEnvironment } from '../providers/EnvironmentProvider'

export function EnvironmentSwitch() {
  const { environment, setEnvironment } = useEnvironment()

  return (
    <div className="env-switch">
      <span>Ambiente</span>
      {ENVIRONMENTS.map((option) => (
        <button
          key={option}
          type="button"
          className={`${environment === option ? 'active' : ''} ${
            option === 'Prod' ? 'prod' : ''
          }`.trim()}
          onClick={() => setEnvironment(option)}
        >
          {option === 'Prod' && <i />}
          {option}
        </button>
      ))}
    </div>
  )
}
