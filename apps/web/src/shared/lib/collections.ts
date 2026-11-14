/** Distinct values, preserving first-seen order. */
export function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

/** Builds the option list of a filter: the "any" sentinel plus each value. */
export function filterOptions<T extends string>(anyLabel: string, values: T[]): string[] {
  return [anyLabel, ...unique(values)]
}
