export type CampaignLocale = 'en' | 'zh-cn'
export type CampaignSite = 'weapp-tailwindcss' | 'weapp-vite'

export interface CampaignCreative {
  brand: string
  copy: string
  logoAlt: string
  logoDarkSrc?: string
  logoSrc: string
}

export interface DisplayCampaign {
  creative: Record<CampaignLocale, CampaignCreative>
  href: string
  id: string
  site: CampaignSite
}

export interface PaidCampaign extends DisplayCampaign {
  endsAt: string
  startsAt: string
}

export const paidCampaigns: PaidCampaign[] = []

export const fallbackCampaign: DisplayCampaign = {
  creative: {
    'en': {
      brand: 'Advertise on weapp-vite',
      copy: 'Exclusive desktop documentation placement for developer tools',
      logoAlt: 'weapp-vite logo',
      logoSrc: '/logo.svg',
    },
    'zh-cn': {
      brand: '在 weapp-vite 投放广告',
      copy: '面向开发者工具的桌面文档侧栏独占广告位',
      logoAlt: 'weapp-vite 标志',
      logoSrc: '/logo.svg',
    },
  },
  href: 'https://github.com/sonofmagic/sponsors/issues/new?template=business-sponsorship-zh.yml',
  id: 'weapp-vite-house-ad',
  site: 'weapp-vite',
}

function toTimestamp(value: string, campaignId: string, field: 'startsAt' | 'endsAt'): number {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) {
    throw new TypeError(`Campaign "${campaignId}" has an invalid ${field}`)
  }
  return timestamp
}

function getCampaignInterval(campaign: PaidCampaign): [number, number] {
  const startsAt = toTimestamp(campaign.startsAt, campaign.id, 'startsAt')
  const endsAt = toTimestamp(campaign.endsAt, campaign.id, 'endsAt')
  if (startsAt >= endsAt) {
    throw new RangeError(`Campaign "${campaign.id}" must end after it starts`)
  }
  return [startsAt, endsAt]
}

export function assertNoCampaignOverlaps(campaigns: readonly PaidCampaign[]): void {
  const campaignsBySite = new Map<CampaignSite, Array<{ campaign: PaidCampaign, endsAt: number, startsAt: number }>>()

  for (const campaign of campaigns) {
    const [startsAt, endsAt] = getCampaignInterval(campaign)
    const siteCampaigns = campaignsBySite.get(campaign.site) ?? []
    siteCampaigns.push({ campaign, endsAt, startsAt })
    campaignsBySite.set(campaign.site, siteCampaigns)
  }

  for (const siteCampaigns of campaignsBySite.values()) {
    siteCampaigns.sort((left, right) => left.startsAt - right.startsAt)
    for (let index = 1; index < siteCampaigns.length; index += 1) {
      const previous = siteCampaigns[index - 1]
      const current = siteCampaigns[index]
      if (current.startsAt < previous.endsAt) {
        throw new RangeError(`Campaigns "${previous.campaign.id}" and "${current.campaign.id}" overlap on ${current.campaign.site}`)
      }
    }
  }
}

export function selectActiveCampaign(
  campaigns: readonly PaidCampaign[],
  site: CampaignSite,
  now: Date = new Date(),
): PaidCampaign | undefined {
  const timestamp = now.getTime()
  if (!Number.isFinite(timestamp)) {
    throw new TypeError('Campaign selection requires a valid date')
  }

  const activeCampaigns = campaigns.filter((campaign) => {
    if (campaign.site !== site) {
      return false
    }
    const [startsAt, endsAt] = getCampaignInterval(campaign)
    return startsAt <= timestamp && timestamp < endsAt
  })

  if (activeCampaigns.length > 1) {
    throw new RangeError(`Multiple active campaigns found for ${site}`)
  }
  return activeCampaigns[0]
}

export function selectDisplayCampaign(
  campaigns: readonly PaidCampaign[],
  site: CampaignSite,
  fallback: DisplayCampaign,
  now: Date = new Date(),
): DisplayCampaign {
  return selectActiveCampaign(campaigns, site, now) ?? fallback
}

assertNoCampaignOverlaps(paidCampaigns)
