import { useMemo, useState } from 'react'
import { Button, Input, Text, View } from '../../runtime/components'

export function ReactStaticPage() {
  const [count, setCount] = useState(0)
  const [name, setName] = useState('React')
  const doubled = useMemo(() => count * 2, [count])
  const theme = 'light'

  return (
    <View className={`page theme-${theme}`} style={{ padding: 16 }}>
      <Text id="title" className="title">weapp-vite React static bindings</Text>
      <View className="panel">
        <Text id="count">{`count:${count} doubled:${doubled}`}</Text>
        <Button id="increment" onTap={() => setCount(value => value + 1)}>increment</Button>
      </View>
      <View className="panel">
        <Input
          id="name-input"
          value={name}
          placeholder="name"
          onInput={event => setName(String(event.detail.value ?? ''))}
        />
        <Text id="greeting">{`hello ${name}`}</Text>
      </View>
    </View>
  )
}
