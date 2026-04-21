import { getSharedLoadMessage, SHARED_ANSWER } from '@/shared/shared-data'
import { getPluginShowcaseSummary, getFeatureCards as getShowcaseCards } from './utils/showcase'

export function sayHello() {
  return getSharedLoadMessage('plugin')
}

export const answer = SHARED_ANSWER

export function getShowcaseSummary() {
  return getPluginShowcaseSummary()
}

export function getFeatureCards() {
  return getShowcaseCards()
}
