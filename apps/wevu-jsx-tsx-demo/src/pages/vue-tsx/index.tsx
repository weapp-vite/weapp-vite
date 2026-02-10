import { defineComponent } from 'vue'
import { definePageJson } from 'weapp-vite'

definePageJson({
  navigationBarTitleText: 'Vue 风格 TSX 页面',
})

export default defineComponent({
  data() {
    return {
      enabled: true,
    }
  },
  methods: {
    toggleEnabled() {
      this.enabled = !this.enabled
    },
    backHome() {
      wx.redirectTo({ url: '/pages/jsx-basic/index' })
    },
  },
  render() {
    return (
      <view class="page">
        <view class="title">Vue 风格 TSX（from vue）</view>
        <view class="desc">defineComponent 从 vue 导入，依旧可走 weapp-vite JSX 编译链。</view>
        <view class={this.enabled ? "card card-on" : "card card-off"}>
          {this.enabled
            ? <text>当前状态：已启用 ✅</text>
            : <text>当前状态：未启用 ⛔️</text>}
        </view>
        <button class="btn" onTap={this.toggleEnabled}>切换状态</button>
        <button class="btn" onTap={this.backHome}>回到 JSX 首页</button>
      </view>
    )
  },
})
