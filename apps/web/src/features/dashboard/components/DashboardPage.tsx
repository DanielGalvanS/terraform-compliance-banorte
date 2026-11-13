import { useNavigation } from '@/shared/navigation'
import { Button, PageTitle } from '@/shared/ui'
import { dashboardRepository } from '../api/dashboardRepository'
import { AgentActivityCard } from './AgentActivityCard'
import { CostCard } from './CostCard'
import { FindingsTrendCard } from './FindingsTrendCard'
import { FrameworkChart } from './FrameworkChart'
import { KpiGrid } from './KpiGrid'
import { PostureBanner } from './PostureBanner'

export function DashboardPage() {
  const { navigate } = useNavigation()

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
      <PostureBanner posture={dashboardRepository.getPosture()} />
      <KpiGrid kpis={dashboardRepository.getKpis()} />
      <div className="dashboard-grid">
        <FrameworkChart scores={dashboardRepository.getFrameworkScores()} />
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
