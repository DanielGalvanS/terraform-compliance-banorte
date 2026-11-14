import { useNavigation } from '@/shared/navigation'
import { Button, Card, PageTitle } from '@/shared/ui'
import { dashboardRepository } from '../api/dashboardRepository'
import { coberturaComoGrafico, conHallazgosReales } from '../api/resumenAdaptadores'
import { useResumen } from '../hooks/useResumen'
import { AgentActivityCard } from './AgentActivityCard'
import { CostCard } from './CostCard'
import { FindingsTrendCard } from './FindingsTrendCard'
import { FrameworkChart } from './FrameworkChart'
import { KpiGrid } from './KpiGrid'
import { PostureBanner } from './PostureBanner'

export function DashboardPage() {
  const { navigate } = useNavigation()
  const carga = useResumen()
  const enVivo = carga.estado === 'listo'

  // Con la API disponible, las cifras que sabe responder sustituyen a las de
  // ejemplo. Las demás tarjetas se quedan como están: la API todavía no puede
  // calcularlas.
  const kpis = enVivo
    ? conHallazgosReales(dashboardRepository.getKpis(), carga.resumen)
    : dashboardRepository.getKpis()
  const cobertura = enVivo
    ? coberturaComoGrafico(carga.resumen)
    : dashboardRepository.getFrameworkScores()

  return (
    <>
      <PageTitle
        eyebrow="OPERACIONES DE CUMPLIMIENTO"
        title="Visión general"
        description="Postura de cumplimiento y actividad del mini data center en GCP."
        action={
          <>
            <Button variant="secondary" icon="download">
              Exportar resumen
            </Button>
            <Button onClick={() => navigate('pipeline')} icon="pipeline">
              Ver pipeline activo
            </Button>
          </>
        }
      />
      {carga.estado === 'error' && (
        // Se avisa, pero no se vacía el tablero: el resto no depende de la API.
        <Card>
          <strong>No se pudo consultar la API: {carga.mensaje}</strong>
          <p>Las cifras que se muestran son datos de ejemplo.</p>
        </Card>
      )}
      <PostureBanner posture={dashboardRepository.getPosture()} />
      <KpiGrid kpis={kpis} />
      <div className="dashboard-grid">
        <FrameworkChart scores={cobertura} fuente={enVivo ? 'api' : 'ejemplo'} />
        <FindingsTrendCard trend={dashboardRepository.getFindingsTrend()} />
        <AgentActivityCard
          activity={dashboardRepository.getAgentActivity()}
          onSeeAll={() => navigate('agent')}
        />
        <CostCard
          cost={dashboardRepository.getCostSummary()}
          onSeeBreakdown={() => navigate('inventory')}
        />
      </div>
    </>
  )
}
