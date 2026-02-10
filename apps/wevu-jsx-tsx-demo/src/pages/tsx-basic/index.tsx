import { definePageJson } from 'weapp-vite'
import { defineComponent } from 'wevu'

interface FeatureItem {
  label: string
  detail: string
}

definePageJson({
  navigationBarTitleText: '纯 TSX 页面',
})

export default defineComponent({
  data() {
    return {
      features: [
        {
          label: '1) TS 类型约束',
          detail: '支持接口与类型推导',
        },
        {
          label: '2) JSX 模板',
          detail: '直接在 render 返回 JSX',
        },
        {
          label: '3) 事件与导航',
          detail: 'onTap 事件与 wx API 均可直接使用',
        },
      ] as FeatureItem[],
    }
  },
  methods: {
    backHome() {
      wx.redirectTo({ url: '/pages/jsx-basic/index' })
    },
  },
  render() {
    return (
      <view className="page">
        <view className="title">纯 TSX（.tsx）</view>
        <view className="desc">以下条目来自 TS 类型数组渲染：</view>
        <view className="card">
          这里展示了 TSX 页面里直接写类型与 JSX 的组合能力。
        </view>
        <view>
          {(this.features as FeatureItem[]).map((item, index) => (
            <view key={index} className="row">
              <text className="code">{item.label}</text>
              <text>
                {' '}
                {item.detail}
              </text>
            </view>
          ))}
        </view>
        <button className="btn" onTap={this.backHome}>回到 JSX 首页</button>
      </view>
    )
  },
})
