import { FilterBar, SelectField } from '@/shared/ui'
import type { FindingFilterKey, FindingFilters as Filters } from '../api/findingsRepository'

type FindingFiltersProps = {
  values: Filters
  options: Record<FindingFilterKey, string[]>
  onChange: (key: FindingFilterKey, value: string) => void
  onClear: () => void
}

const FIELDS: { key: FindingFilterKey; label: string }[] = [
  { key: 'severity', label: 'Severidad' },
  { key: 'framework', label: 'Marco' },
  { key: 'control', label: 'Control' },
  { key: 'environment', label: 'Ambiente' },
  { key: 'origin', label: 'Origen' },
  { key: 'state', label: 'Estado' },
]

export function FindingFilters({ values, options, onChange, onClear }: FindingFiltersProps) {
  return (
    <FilterBar onClear={onClear}>
      {FIELDS.map((field) => (
        <SelectField
          key={field.key}
          label={field.label}
          value={values[field.key]}
          options={options[field.key]}
          onChange={(value) => onChange(field.key, value)}
        />
      ))}
    </FilterBar>
  )
}
