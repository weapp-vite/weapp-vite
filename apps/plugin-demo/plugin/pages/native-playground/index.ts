import { getFeatureCards, getPluginShowcaseSummary, getScoreTone } from '../../utils/showcase'

Page({
  data: {
    cards: getFeatureCards(),
    currentCard: getFeatureCards()[0],
    currentIndex: 0,
    meterTone: 'success',
    pluginSummary: getPluginShowcaseSummary(),
  },
  nextCard() {
    const nextIndex = (this.data.currentIndex + 1) % this.data.cards.length
    const currentCard = this.data.cards[nextIndex]
    this.setData({
      currentCard,
      currentIndex: nextIndex,
      meterTone: getScoreTone(currentCard.score),
    })
  },
})
