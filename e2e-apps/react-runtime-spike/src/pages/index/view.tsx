import { createContext, useContext, useMemo, useState } from 'react'
import { Button, Input, Text, View } from '../../runtime/components'

const ThemeContext = createContext('light')

function CounterPanel() {
  const theme = useContext(ThemeContext)
  const [count, setCount] = useState(0)
  const [items, setItems] = useState(['alpha', 'beta'])
  const [name, setName] = useState('React')
  const doubled = useMemo(() => count * 2, [count])

  return (
    <View className={`page theme-${theme}`} style={{ padding: 16 }}>
      <Text id="title" className="title">weapp-vite React runtime spike</Text>
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
      <View className="panel">
        {items.map(item => <Text key={item} className="item">{item}</Text>)}
        <Button id="append" onTap={() => setItems(previous => [...previous, `item-${previous.length}`])}>append</Button>
      </View>
    </View>
  )
}

export function ReactSpikePage() {
  return (
    <ThemeContext.Provider value="light">
      <CounterPanel />
    </ThemeContext.Provider>
  )
}
