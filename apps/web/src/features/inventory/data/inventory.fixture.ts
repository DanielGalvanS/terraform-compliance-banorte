import type { Environment } from '@/shared/model'
import type { Tag } from '@/shared/ui'
import type {
  ComplianceState,
  InventorySummary,
  NetworkTopology,
  Resource,
  TerraformModule,
} from '../model'

/** Mandatory tag set every managed resource must carry. */
function mandatoryTags(environment: Environment, overrides: Tag[] = []): Tag[] {
  return [
    { text: 'dueño:platform' },
    { text: `amb:${environment.toLowerCase()}` },
    ...overrides,
    { text: 'costo:cc-1042' },
    { text: `marco:${environment === 'Prod' ? 'pci-cnbv' : 'cis'}` },
  ]
}

function resource(
  name: string,
  module: string,
  moduleVersion: string,
  environment: Environment,
  state: ComplianceState,
  tagOverrides?: Tag[],
): Resource {
  return {
    name,
    module,
    moduleVersion,
    environment,
    state,
    tags: mandatoryTags(environment, tagOverrides ?? [{ text: 'datos:confidencial' }]),
  }
}

export const resources: Resource[] = [
  resource('vpc-mdc-prod', 'Networking', 'v5.3.0', 'Prod', 'Conforme'),
  resource('subnet-data-prod', 'Networking', 'v5.3.0', 'Prod', 'Conforme'),
  resource('fw-allow-ssh', 'Firewall', 'v3.8.2', 'Prod', 'No conforme'),
  resource('nat-mdc-prod-01', 'Cloud NAT', 'v4.1.0', 'Prod', 'Conforme'),
  resource('sql-mdc-qa-01', 'Cloud SQL', 'v6.0.1', 'QA', 'Advertencia'),
  resource('gcs-audit-evidence', 'Cloud Storage', 'v4.2.0', 'Prod', 'Conforme'),
  resource('sa-terraform-prod', 'Service Accounts', 'v2.9.0', 'Prod', 'Conforme'),
  resource('sm-app-secrets', 'Secret Manager', 'v1.7.4', 'Prod', 'Sin etiqueta', [
    { text: '+ centro-costos', missing: true },
  ]),
  resource('vpn-mdc-prod-ha', 'VPN', 'v3.4.1', 'Prod', 'Conforme'),
]

export const ALL_MODULES = 'Todos'

export const modules: TerraformModule[] = [
  { name: ALL_MODULES, resourceCount: 184, icon: 'inventory' },
  { name: 'Networking', resourceCount: 42, icon: 'inventory' },
  { name: 'Firewall', resourceCount: 18, icon: 'shield' },
  { name: 'Cloud NAT', resourceCount: 4, icon: 'inventory' },
  { name: 'Cloud SQL', resourceCount: 12, icon: 'cloud' },
  { name: 'Cloud Storage', resourceCount: 26, icon: 'inventory' },
  { name: 'Service Accounts', resourceCount: 38, icon: 'inventory' },
  { name: 'Secret Manager', resourceCount: 16, icon: 'inventory' },
  { name: 'VPN', resourceCount: 8, icon: 'inventory' },
]

export const summaries: InventorySummary[] = [
  { label: 'Recursos gestionados', value: '184', footnote: '100% en Terraform' },
  { label: 'Módulos activos', value: '8', footnote: '2 actualizaciones disponibles' },
  { label: 'Cobertura de etiquetas', value: '98,4%', footnote: '3 etiquetas faltantes', alert: true },
  { label: 'Último refresh', value: '3 min', footnote: 'Sin cambios externos' },
]

export const topology: NetworkTopology = {
  environment: 'Prod',
  region: 'us-central1',
  gateway: { name: 'Cloud Armor', detail: 'WAF · activo' },
  vpc: {
    name: 'vpc-mdc-prod',
    subnets: [
      { name: 'subnet-app', cidr: '10.10.1.0/24' },
      { name: 'subnet-data', cidr: '10.10.2.0/24' },
    ],
    services: ['Cloud SQL', 'Storage', 'Secrets'],
  },
  vpn: { name: 'HA VPN', detail: 'Banco · CDMX' },
}
