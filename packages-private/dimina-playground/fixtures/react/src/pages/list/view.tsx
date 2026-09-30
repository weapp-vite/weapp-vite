import { Button, Text, View } from '@weapp-vite/react'
import { useState } from 'react'

export function AppView() {
  const [items, setItems] = useState(['初始条目'])
  return (
    <View>
      <Button onTap={() => setItems(value => [...value, `条目 ${value.length}`])}>添加条目</Button>
      {items.map(item => <Text key={item}>{item}</Text>)}
    </View>
  )
}
