import type { Environment } from '@/shared/model'
import { tagsFromValues } from '../model'
import type {
  ComplianceState,
  InventorySummary,
  NetworkTopology,
  Resource,
  TagValues,
  TerraformModule,
} from '../model'

const CENTRO_COSTOS = 'cc-1042'

/** Marco que aplica a cada ambiente, de los tres confirmados con Cumplimiento. */
function marcoDe(environment: Environment): string {
  return environment === 'Prod' ? 'lfpdppp' : 'cis-gcp'
}

/** Valores que debería declarar todo recurso gestionado del ambiente. */
function valoresCompletos(environment: Environment): TagValues {
  return {
    duenio: 'plataforma',
    ambiente: environment.toLowerCase(),
    clasificacion_datos: environment === 'Prod' ? 'confidencial' : 'interno',
    centro_costos: CENTRO_COSTOS,
    marco_aplicable: marcoDe(environment),
  }
}

function resource(
  name: string,
  module: string,
  moduleVersion: string,
  environment: Environment,
  state: ComplianceState,
  /** Claves que al recurso le faltan; cada una se dibuja como incumplimiento. */
  etiquetasFaltantes: (keyof TagValues)[] = [],
): Resource {
  const valores = valoresCompletos(environment)
  for (const clave of etiquetasFaltantes) delete valores[clave]

  return {
    name,
    module,
    moduleVersion,
    environment,
    state,
    tags: tagsFromValues(valores),
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
    'centro_costos',
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
