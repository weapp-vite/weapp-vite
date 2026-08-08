import { Button, Text, View } from '@weapp-vite/react'
import { useState } from 'react'

export function AppView() {
  const [count, setCount] = useState(0)
  return (
    <View className="page">
      <Text>
        count:
        {count}
      </Text>
      <Button onTap={() => setCount(value => value + 1)}>add</Button>
    </View>
  )
}
