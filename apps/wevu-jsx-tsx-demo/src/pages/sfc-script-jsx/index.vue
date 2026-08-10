<script lang="jsx">
import { defineComponent } from 'wevu'

export default defineComponent({
  data() {
    return {
      count: 4,
    }
  },
  methods: {
    increment() {
      this.count += 1
    },
    runE2E() {
      const initial = this.count
      this.increment()
      return { initial, next: this.count }
    },
  },
  render() {
    return (
      <view className="page">
        <view className="title">SFC script JSX</view>
        <text id="sfc-jsx-count">sfc jsx count: {this.count}</text>
        <button id="sfc-jsx-increase" onTap={this.increment}>increment</button>
      </view>
    )
  },
})
</script>
