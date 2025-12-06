const languageFeatures = [
  'TypeScript / JSX / TSX 全量支持',
  'WXS/TS WXS 一体化构建',
  'alias 与 take: 前缀路径解析',
  'require.async / import() 统一编译',
]

const buildFeatures = [
  'app.json 自动生成（主包 + 分包）',
  'subPackages 与 sharedStrategy：hoist / duplicate',
  '独立分包/worker 独立上下文',
  'analyze dashboard 可视化依赖图',
]

const styleFeatures = [
  'Tailwind 原子类 + SCSS/LESS/Sass',
  '按需引入 TDesign / Vant 组件解析',
  'WXSS/SCSS 路径别名与资源内联',
  '自定义 tabbar / appBar 统一样式',
]

const runtimeHooks = [
  '自动 watch 与热更新（pnpm dev）',
  'watchFiles 调试输出 / inspector',
  'chunks.duplicateWarningBytes 体积告警',
  'buildTarget: app / plugin / subpackage 切换',
]

Page({
  data: {
    languageFeatures,
    buildFeatures,
    styleFeatures,
    runtimeHooks,
    envPreview: JSON.stringify(import.meta.env, null, 2),
  },

  handleNavigateSubpackages() {
    wx.navigateTo({ url: '/pages/subpackages/demo' })
  },

  handleNavigateUI() {
    wx.navigateTo({ url: '/pages/features/ui/index' })
  },

  handleCopyEnv() {
    wx.setClipboardData({
      data: JSON.stringify(import.meta.env, null, 2),
      success: () => wx.showToast({ title: '已复制 env', icon: 'none' }),
    })
  },
})
