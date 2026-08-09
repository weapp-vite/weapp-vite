import type { BenchCard } from '../../utils/bench'

declare const cards: BenchCard[]
declare const summary: string

export default {
  render() {
    return (
      <view className="page">
        <view id="bench-ready-marker" className="hero">
          <view className="hero__title">Solid-style Detail Target</view>
          <view className="hero__summary">{summary}</view>
        </view>
        {cards.map(card => (
          <view key={card.id} className="card">
            <view className="card__row">
              <text className="card__title">{card.title}</text>
              <text className={card.active ? 'card__badge card__badge--active' : 'card__badge'}>
                {card.active ? 'active' : 'idle'}
              </text>
            </view>
            <view className="card__meta">
              <text>
                score
                {card.score}
              </text>
              <text>
                delta
                {card.delta}
              </text>
            </view>
            <view className="card__summary">{card.summary}</view>
            <view className="card__tags">
              {card.tags.map(tag => <text key={tag} className="card__tag">{tag}</text>)}
            </view>
          </view>
        ))}
      </view>
    )
  },
}
