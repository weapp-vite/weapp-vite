import { Button, Text, View } from '@weapp-vite/react'
import { useState } from 'react'

export function AgentProofView() {
  const [count, setCount] = useState(0)

  return (
    <View className="page">
      <Text id="count">{count}</Text>
      <Button id="increment" onTap={() => setCount(value => value + 1)}>
        增加一次
      </Button>
    </View>
  )
}
