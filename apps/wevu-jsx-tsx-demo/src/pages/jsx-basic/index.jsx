import { definePageJson } from 'weapp-vite'
import { defineComponent } from 'wevu'

definePageJson({
  navigationBarTitleText: '纯 JSX 页面',
})

export default defineComponent({
  data() {
    return {
      count: 0,
    }
  },
  methods: {
    increase() {
      this.count += 1
    },
    goTsx() {
      wx.navigateTo({ url: '/pages/tsx-basic/index' })
    },
    goVueTsx() {
      wx.navigateTo({ url: '/pages/vue-tsx/index' })
    },
  },
  render() {
    return (
      <view className="page">
        <view className="title">纯 JSX（.jsx）</view>
        <view className="desc">这个页面完全由 JSX 编写并编译为 WXML。</view>
        <view className="card">
          当前计数：
          {this.count}
        </view>
        <button className="btn" onTap={this.increase}>计数 +1</button>
        <button className="btn" onTap={this.goTsx}>打开 TSX 页面</button>
        <button className="btn" onTap={this.goVueTsx}>打开 Vue TSX 页面</button>
      </view>
    )
  },
})
