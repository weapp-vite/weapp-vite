import { getSharedLoadMessage } from '@/shared/shared-data'

interface PluginFeatureCard {
  id: string
  title: string
  summary: string
  kindLabel: string
  score: number
}

interface HelloPlugin {
  answer: number
  getFeatureCards: () => PluginFeatureCard[]
  getShowcaseSummary: () => string
  sayHello: () => void
}

const plugin = requirePlugin('hello-plugin') as HelloPlugin

Page({
  data: {
    featureCards: [] as PluginFeatureCard[],
    hostMessage: '',
    pluginAnswer: 0,
    pluginSummary: '',
    showcaseProgress: 78,
  },
  onLoad() {
    plugin.sayHello()
    this.setData({
      featureCards: plugin.getFeatureCards(),
      hostMessage: getSharedLoadMessage('miniprogram'),
      pluginAnswer: plugin.answer,
      pluginSummary: plugin.getShowcaseSummary(),
    })
  },
  boostShowcase() {
    const nextValue = this.data.showcaseProgress >= 96
      ? 72
      : this.data.showcaseProgress + 6
    this.setData({
      showcaseProgress: nextValue,
    })
  },
})
