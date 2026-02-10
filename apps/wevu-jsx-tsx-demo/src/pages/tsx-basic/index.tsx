import { definePageJson } from 'weapp-vite'
import { defineComponent } from 'wevu'
import InfoCard from '../../components/info-card/index.vue'

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
          label: '3) 自动组件推导',
          detail: 'InfoCard 从 import 自动进入 usingComponents',
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
        <InfoCard
          title="自动 usingComponents 推导"
          description="此卡片来自 .vue 组件导入，无需手写页面 JSON 的 usingComponents。"
        />
        <view className="desc">以下条目来自 TS 类型数组渲染：</view>
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
