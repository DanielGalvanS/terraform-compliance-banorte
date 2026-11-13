import { Badge, Card, CardHeader, Icon } from '@/shared/ui'
import type { NetworkTopology } from '../model'

export function NetworkTopologyCard({ topology }: { topology: NetworkTopology }) {
  return (
    <Card className="topology">
      <CardHeader
        title="Topología de red"
        subtitle={`${topology.environment} · ${topology.region}`}
        aside={<Badge tone="success">Operativa</Badge>}
      />
      <div className="network-map">
        <div className="internet-node">
          <Icon name="cloud" />
          Internet
        </div>
        <span className="connection horizontal one" />
        <div className="network-node gateway">
          <Icon name="shield" />
          <strong>{topology.gateway.name}</strong>
          <small>{topology.gateway.detail}</small>
        </div>
        <span className="connection horizontal two" />
        <div className="vpc-box">
          <label>VPC · {topology.vpc.name}</label>
          {topology.vpc.subnets.map((subnet) => (
            <div className="subnet" key={subnet.name}>
              <strong>{subnet.name}</strong>
              <small>{subnet.cidr}</small>
            </div>
          ))}
          <div className="map-services">
            {topology.vpc.services.map((service) => (
              <span key={service}>{service}</span>
            ))}
          </div>
        </div>
        <div className="vpn-node">
          <Icon name="lock" />
          <strong>{topology.vpn.name}</strong>
          <small>{topology.vpn.detail}</small>
        </div>
      </div>
    </Card>
  )
}
