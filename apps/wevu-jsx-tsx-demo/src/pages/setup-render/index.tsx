import { definePageJson } from 'weapp-vite'
import { defineComponent, ref } from 'wevu'

definePageJson({
  navigationBarTitleText: 'Setup TSX Render',
})

export default defineComponent({
  setup() {
    const count = ref(2)
    const increment = () => {
      count.value += 1
    }
    return () => (
      <view className="page">
        <view className="title">Setup render closure</view>
        <text id="setup-render-count">setup count: {count.value}</text>
        <button id="setup-render-increase" onTap={increment}>increment</button>
      </view>
    )
  },
})
