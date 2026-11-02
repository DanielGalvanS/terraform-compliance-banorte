import {
  ALL_MODULES,
  modules,
  resources,
  summaries,
  topology,
} from '../data/inventory.fixture'
import type { InventorySummary, NetworkTopology, Resource, TerraformModule } from '../model'

export type ResourceQuery = {
  /** Module name, or `ALL_MODULES` for no module filter. */
  module: string
  search: string
}

export const inventoryRepository = {
  getSummaries: (): InventorySummary[] => summaries,
  getModules: (): TerraformModule[] => modules,
  getTopology: (): NetworkTopology => topology,
  getResources: (): Resource[] => resources,

  /** Filtering lives next to the data so pages stay declarative. */
  queryResources({ module, search }: ResourceQuery): Resource[] {
    const needle = search.trim().toLowerCase()
    return resources.filter(
      (item) =>
        (module === ALL_MODULES || item.module === module) &&
        item.name.toLowerCase().includes(needle),
    )
  },
}

export { ALL_MODULES }
