<script lang="ts" setup>
import type { CampaignLocale } from './sponsorCampaigns'
import { useData } from 'vitepress'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  fallbackCampaign,
  paidCampaigns,
  selectDisplayCampaign,
} from './sponsorCampaigns'

const CAMPAIGN_REFRESH_INTERVAL = 60_000
const { lang } = useData()
const now = ref<Date>()
let refreshTimer: ReturnType<typeof setInterval> | undefined

const locale = computed<CampaignLocale>(() => (
  lang.value.toLowerCase().startsWith('en') ? 'en' : 'zh-cn'
))
const campaign = computed(() => selectDisplayCampaign(
  paidCampaigns,
  'weapp-vite',
  fallbackCampaign,
  now.value,
))
const creative = computed(() => campaign.value.creative[locale.value])
const campaignHref = computed(() => {
  if (campaign.value.id !== fallbackCampaign.id || locale.value === 'zh-cn') {
    return campaign.value.href
  }
  return 'https://github.com/sonofmagic/sponsors/issues/new?template=business-sponsorship-en.yml'
})

onMounted(() => {
  now.value = new Date()
  refreshTimer = setInterval(() => {
    now.value = new Date()
  }, CAMPAIGN_REFRESH_INTERVAL)
})

onBeforeUnmount(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
})
</script>

<template>
  <div
    class="sponsor-ad-slot"
    :data-sponsor-campaign="campaign.id"
  >
    <a
      class="sponsor-ad"
      :href="campaignHref"
      target="_blank"
      rel="noopener sponsored nofollow"
      :aria-label="`${creative.brand}: ${creative.copy}`"
    >
      <span class="sponsor-ad__label">
        {{ campaign.id === 'weapp-vite-house-ad' ? (locale === 'en' ? 'Partner with us' : '赞助合作') : (locale === 'en' ? 'Sponsored' : '赞助商') }}
      </span>
      <span class="sponsor-ad__logo-frame">
        <img
          class="sponsor-ad__logo"
          :class="{ 'sponsor-ad__logo--light': creative.logoDarkSrc }"
          :src="creative.logoSrc"
          :alt="creative.logoAlt"
          width="48"
          height="48"
        >
        <img
          v-if="creative.logoDarkSrc"
          class="sponsor-ad__logo sponsor-ad__logo--dark"
          :src="creative.logoDarkSrc"
          :alt="creative.logoAlt"
          width="48"
          height="48"
        >
      </span>
      <strong class="sponsor-ad__brand">{{ creative.brand }}</strong>
      <span class="sponsor-ad__copy">{{ creative.copy }}</span>
    </a>
  </div>
</template>

<style scoped>
.sponsor-ad-slot {
  width: 100%;
  height: 196px;
  margin-top: 20px;
}

.sponsor-ad {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 196px;
  padding: 18px 14px;
  color: var(--vp-c-text-1);
  text-align: center;
  text-decoration: none;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  transition:
    border-color 160ms ease,
    background-color 160ms ease;
}

.sponsor-ad:hover {
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-alt);
  border-color: var(--vp-c-brand-1);
}

.sponsor-ad__label {
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  color: var(--vp-c-text-2);
  text-transform: uppercase;
}

.sponsor-ad__logo-frame {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 48px;
}

.sponsor-ad__logo {
  width: auto;
  max-width: 160px;
  height: 48px;
  object-fit: contain;
}

.sponsor-ad__logo--dark {
  display: none;
}

:global(.dark) .sponsor-ad__logo--light {
  display: none;
}

:global(.dark) .sponsor-ad__logo--dark {
  display: block;
}

.sponsor-ad__brand {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  line-height: 20px;
  white-space: nowrap;
}

.sponsor-ad__copy {
  display: -webkit-box;
  min-height: 36px;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  font-size: 12px;
  line-height: 18px;
  color: var(--vp-c-text-2);
}

@media (max-width: 1279px) {
  .sponsor-ad-slot {
    display: none;
  }
}
</style>
