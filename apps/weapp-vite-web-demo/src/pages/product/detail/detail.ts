interface ProductSpec {
  id: string
  label: string
  value: string
}

interface ProductOption {
  id: string
  label: string
  note: string
  selected?: boolean
}

interface ProductSectionItem {
  id: string
  title: string
  desc: string
}

interface ReviewItem {
  id: string
  user: string
  tag: string
  content: string
}

const specs: ProductSpec[] = [
  { id: 'chip', label: '处理器', value: 'NPU 24 TOPS' },
  { id: 'screen', label: '屏幕', value: '2.5K 高刷护眼屏' },
  { id: 'battery', label: '续航', value: '18 小时长续航' },
  { id: 'sound', label: '音频', value: '六扬声器阵列' },
]

const colorOptions: ProductOption[] = [
  { id: 'graphite', label: '星舰灰', note: '哑光金属', selected: true },
  { id: 'silver', label: '冰川银', note: '冷白玻璃' },
  { id: 'blue', label: '远峰蓝', note: '限定配色' },
]

const bundleOptions: ProductOption[] = [
  { id: 'base', label: '标准套装', note: '主机 + 65W 氮化镓快充', selected: true },
  { id: 'creator', label: '创作者套装', note: '含磁吸键盘与手写笔' },
  { id: 'care', label: '安心套装', note: '含两年碎屏保障' },
]

const serviceItems: ProductSectionItem[] = [
  { id: 'fast', title: '当日达', desc: '18:00 前下单，核心城市最快 4 小时送达。' },
  { id: 'trade', title: '以旧换新', desc: '旧设备最高补贴 1800 元，现场数据迁移。' },
  { id: 'trial', title: '30 天无忧试用', desc: '支持门店取还，保留完整包装即可。' },
]

const featureItems: ProductSectionItem[] = [
  { id: 'display', title: '全域护眼显示', desc: '环境光自适应，低蓝光和高刷同时开启。' },
  { id: 'cooling', title: '无感散热架构', desc: 'VC 均热板覆盖核心区域，重负载低噪运行。' },
  { id: 'ai', title: '本地 AI 加速', desc: '图片检索、语音纪要和跨应用摘要在端侧完成。' },
]

const reviews: ReviewItem[] = [
  { id: 'r1', user: '设计师 L.', tag: '已用 21 天', content: '屏幕和扬声器明显越级，外出改稿不用再带第二台设备。' },
  { id: 'r2', user: '工程师 Q.', tag: '首发购入', content: '续航很稳，IDE、浏览器和视频会议同时开也没有明显掉帧。' },
]

function resolveIteration(query: Record<string, string>) {
  const directValue = query?.iteration
  if (directValue) {
    return directValue
  }
  if (typeof window === 'undefined') {
    return ''
  }
  const params = new URLSearchParams(window.location.search)
  const hashQuery = window.location.hash.includes('?')
    ? window.location.hash.slice(window.location.hash.indexOf('?') + 1)
    : ''
  return params.get('iteration') ?? new URLSearchParams(hashQuery).get('iteration') ?? ''
}

Page({
  data: {
    iteration: 10,
    activeColor: 'graphite',
    activeBundle: 'base',
    favorited: false,
    specs,
    colorOptions,
    bundleOptions,
    serviceItems,
    featureItems,
    reviews,
    gallery: [
      '/retail-goods-01.jpg',
      '/retail-goods-02.jpg',
      '/retail-goods-03.jpg',
    ],
    couponTags: ['满减', '满折', '免息', '赠品'],
    badges: ['旗舰新品', '现货发售', '门店同价'],
    stockText: '1 件，星舰灰，标准套装',
    intro: '轻薄旗舰机身，端侧 AI 加速，覆盖移动办公、影像创作与家庭影音。',
    qa: [
      '支持 Type-C 外接双 4K 显示器。',
      '首批附赠 1 年云空间和门店清洁服务。',
    ],
  },
  onLoad(query: Record<string, string>) {
    const nextIteration = Number.parseInt(resolveIteration(query) || '10', 10)
    if (Number.isFinite(nextIteration)) {
      this.setData({
        iteration: Math.max(1, Math.min(nextIteration, 10)),
      })
    }
  },
  handleColorTap(event: WechatMiniprogram.TouchEvent) {
    const { id } = event.currentTarget.dataset as { id?: string }
    if (!id) {
      return
    }
    this.setData({
      activeColor: id,
      colorOptions: colorOptions.map(item => ({ ...item, selected: item.id === id })),
    })
  },
  handleBundleTap(event: WechatMiniprogram.TouchEvent) {
    const { id } = event.currentTarget.dataset as { id?: string }
    if (!id) {
      return
    }
    this.setData({
      activeBundle: id,
      bundleOptions: bundleOptions.map(item => ({ ...item, selected: item.id === id })),
    })
  },
  toggleFavorite() {
    this.setData({
      favorited: !(this.data.favorited as boolean),
    })
  },
  buyNow() {
    if (typeof wx !== 'undefined' && typeof wx.showToast === 'function') {
      wx.showToast({
        title: '已进入结算',
        icon: 'success',
      })
    }
  },
})
