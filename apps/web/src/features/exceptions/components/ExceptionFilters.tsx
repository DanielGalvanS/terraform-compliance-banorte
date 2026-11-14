import { FilterBar, SearchInput, SelectField } from '@/shared/ui'
import type { ExceptionFilterKey, ExceptionFilters as Filters } from '../api/exceptionsRepository'

type ExceptionFiltersProps = {
  values: Filters
  options: Record<ExceptionFilterKey, string[]>
  search: string
  onChange: (key: ExceptionFilterKey, value: string) => void
  onSearchChange: (search: string) => void
  onClear: () => void
}

const FIELDS: { key: ExceptionFilterKey; label: string }[] = [
  { key: 'state', label: 'Estado' },
  { key: 'framework', label: 'Marco' },
  { key: 'severity', label: 'Severidad' },
  { key: 'environment', label: 'Ambiente' },
]

export function ExceptionFilters({
  values,
  options,
  search,
  onChange,
  onSearchChange,
  onClear,
}: ExceptionFiltersProps) {
  return (
    <FilterBar className="exception-filters" onClear={onClear}>
      {FIELDS.map((field) => (
        <SelectField
          key={field.key}
          label={field.label}
          value={values[field.key]}
          options={options[field.key]}
          onChange={(value) => onChange(field.key, value)}
        />
      ))}
      <label className="exception-search">
        Buscar
        <SearchInput
          label="Buscar excepciones"
          placeholder="Recurso o control"
          value={search}
          onChange={onSearchChange}
          size={14}
        />
      </label>
    </FilterBar>
  )
}
