import { Button, Slot, Text, View } from '@weapp-vite/react'

interface ReactLeafViewProps {
  label: string
  onChange: () => void
  value: number
}

export function ReactLeafView({ label, onChange, value }: ReactLeafViewProps) {
  return (
    <View className="leaf" data-e2e-leaf="react">
      <Text className="leaf-label">{`${label}:${value}`}</Text>
      <Slot />
      <Button id="react-leaf-action" onTap={onChange}>react +1</Button>
    </View>
  )
}
