import { definePageJson } from 'weapp-vite'
import { defineComponent } from 'wevu'
import InfoCard from '../../components/info-card/index.vue'
import { createDynamicBlock, createSharedPanel, sharedFragment } from '../../shared'

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
      islandCount: 0,
      lastCardEvent: '',
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
    increaseIslandCount(this: { islandCount: number }) {
      this.islandCount += 1
    },
    handleCardChange(this: { lastCardEvent: string }, event: { detail: string }) {
      this.lastCardEvent = event.detail
    },
    runE2E(this: any) {
      const island = this.__wv_jsx_islands?.i0
      const handlerId = island?.events?.tap
      const initial = this.islandCount
      this.__weapp_vite_jsx_island({
        type: 'tap',
        currentTarget: {
          dataset: {
            wvJsxHandler: handlerId,
          },
        },
      })
      return {
        handlerId,
        initial,
        next: this.islandCount,
        nodeKind: island?.kind,
        nodeTag: island?.tag,
      }
    },
    emitInfoCardChange(this: any) {
      const infoCard = this.selectComponent('#tsx-info-card-component')
      if (!infoCard) {
        return false
      }
      infoCard.emitChange()
      return true
    },
    backHome() {
      wx.redirectTo({ url: '/pages/jsx-basic/index' })
    },
  },
  render() {
    return (
      <view className="page">
        <view className="title">纯 TSX（.tsx）</view>
        <InfoCard
          id="tsx-info-card-component"
          title="自动 usingComponents 推导"
          description="此卡片来自 .vue 组件导入。"
          onChange={this.handleCardChange}
        />
        <view className="desc">以下条目来自 TS 类型数组渲染：</view>
        <view className="card">
          这里展示了 TSX 页面里直接写类型与 JSX 的组合能力。
        </view>
        {sharedFragment}
        {createSharedPanel('跨文件参数化 JSX factory')}
        {createDynamicBlock(() => (
          <button id="tsx-island-button" className="btn" onTap={this.increaseIslandCount}>
            dynamic island:
            {' '}
            {this.islandCount}
          </button>
        ))}
        <view>
          {(this.features as FeatureItem[]).map((item, index) => (
            <view id={`tsx-feature-${index}`} key={index} className="row">
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
