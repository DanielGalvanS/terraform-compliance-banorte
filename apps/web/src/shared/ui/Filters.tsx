import type { ReactNode } from 'react'
import { Card } from './Card'
import { Icon } from './Icon'

type FilterBarProps = {
  children: ReactNode
  onClear: () => void
  className?: string
}

export function FilterBar({ children, onClear, className = '' }: FilterBarProps) {
  return (
    <Card className={`filter-bar ${className}`.trim()}>
      <span>
        <Icon name="filter" size={16} />
        Filtros
      </span>
      {children}
      <button type="button" className="clear-filter" onClick={onClear}>
        Limpiar
      </button>
    </Card>
  )
}

type SelectFieldProps = {
  label: string
  value: string
  options: readonly string[]
  onChange: (value: string) => void
  className?: string
}

export function SelectField({ label, value, options, onChange, className }: SelectFieldProps) {
  return (
    <label className={className}>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

type SearchInputProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label: string
  size?: number
}

/** Compact inline search, used in card headers and filter bars. */
export function SearchInput({ value, onChange, placeholder, label, size = 15 }: SearchInputProps) {
  return (
    <span className="mini-search">
      <Icon name="search" size={size} />
      <input
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </span>
  )
}
