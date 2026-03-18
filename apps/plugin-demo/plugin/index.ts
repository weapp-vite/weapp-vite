import { getSharedLoadMessage, SHARED_ANSWER } from '@/shared/shared-data'
import { getFeatureCards as getShowcaseCards, getPluginShowcaseSummary } from './utils/showcase'

export function sayHello() {
  console.log(getSharedLoadMessage('plugin'))
}

export const answer = SHARED_ANSWER

export function getShowcaseSummary() {
  return getPluginShowcaseSummary()
}

export function getFeatureCards() {
  return getShowcaseCards()
}
