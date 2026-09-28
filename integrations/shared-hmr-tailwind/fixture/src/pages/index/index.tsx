import { Button, View } from '@tarojs/components'
import { useState } from 'react'

export default function Index() {
  const [count, setCount] = useState(0)
  return (
    <View>
      <View id="shared-utility" className="bg-[#fce7f3] py-5.5">shared utility</View>
      <Button id="shared-count" onClick={() => setCount(value => value + 1)}>{count}</Button>
    </View>
  )
}
