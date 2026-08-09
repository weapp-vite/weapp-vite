import type { BenchCard } from '../utils/bench'
import { Text, View } from '@weapp-vite/react'

export function BenchCards(props: { cards: BenchCard[], includeTags?: boolean }) {
  return props.cards.map(card => (
    <View key={card.id} className="card">
      <View className="card__row">
        <Text className="card__title">{card.title}</Text>
        <Text className={`card__badge ${card.active ? 'card__badge--active' : ''}`}>
          {card.active ? 'active' : 'idle'}
        </Text>
      </View>
      <View className="card__meta">
        <Text>{`score ${card.score}`}</Text>
        <Text>{`delta ${card.delta}`}</Text>
      </View>
      <View className="card__summary">{card.summary}</View>
      {props.includeTags
        ? (
            <View className="card__tags">
              {card.tags.map(tag => <Text key={tag} className="card__tag">{tag}</Text>)}
            </View>
          )
        : null}
    </View>
  ))
}
