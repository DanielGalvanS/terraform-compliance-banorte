import { Icon, type IconName } from './Icon'

type HumanOversightBannerProps = {
  title: string
  description: string
  icon?: IconName
}

/**
 * States the human-in-the-loop guarantee. It appears wherever the product is
 * about to act on production, so the wording is passed in by the page.
 */
export function HumanOversightBanner({
  title,
  description,
  icon = 'lock',
}: HumanOversightBannerProps) {
  return (
    <div className="human-banner">
      <Icon name={icon} />
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </div>
  )
}
