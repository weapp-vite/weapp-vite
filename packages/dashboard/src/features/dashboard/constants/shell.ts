import type { DashboardNavItem } from '../types'

export const workspaceNavigation: DashboardNavItem[] = [
  { to: '/', label: '工作台', caption: '应用入口与状态总览', iconName: 'nav-home' },
  { to: '/analyze', label: '分析视图', caption: '保留现有 analyze 面板', iconName: 'nav-analyze' },
  { to: '/activity', label: '活动流', caption: '诊断、事件与后续动作', iconName: 'nav-activity' },
  { to: '/tokens', label: '设计令牌', caption: '主题、表面与组件预览', iconName: 'nav-tokens' },
]

export const workspaceHighlights = [
  {
    title: 'Workspace Readiness',
    description: '把 dashboard 从单页分析器抬升成完整 UI 外壳，便于后续不断挂接调试能力。',
    iconName: 'hero-workspace' as const,
    eyebrow: 'Structure',
  },
  {
    title: 'Command Surface',
    description: '为 CLI、MCP、构建分析和任务编排预留固定入口，不再把所有操作塞在一个页面里。',
    iconName: 'hero-commands' as const,
    eyebrow: 'Action',
  },
  {
    title: 'System Language',
    description: '通过统一表面、徽标、区块标题和主题令牌，保证后续新增页面不会继续发散。',
    iconName: 'hero-system' as const,
    eyebrow: 'Design',
  },
]

export const workspaceMetrics = [
  { label: '页面骨架', value: '4 个', iconName: 'metric-ready' as const },
  { label: '健康评分', value: '92 / 100', iconName: 'metric-health' as const },
  { label: '交互延迟预算', value: '< 120ms', iconName: 'metric-latency' as const },
  { label: '视觉一致性', value: '已收敛', iconName: 'metric-quality' as const },
]

export const quickCommands = [
  { label: '启动开发', command: 'pnpm --filter @weapp-vite/dashboard dev', note: '本地预览完整 UI 壳子' },
  { label: '生产构建', command: 'pnpm --filter @weapp-vite/dashboard build', note: '验证静态产物可发布' },
  { label: '主包联调', command: 'weapp-vite build --ui', note: '从 CLI 注入真实分析数据' },
]

export const releaseChecklist = [
  '先保留 `analyze` 现有数据契约，不在第一轮改动里破坏 CLI 注入。',
  '新增页面全部基于假数据和通用组件，后面按模块逐步替换成真实数据源。',
  '主题切换提升到应用级，避免每个页面各自维护深浅色状态。',
]

export const activityFeed = [
  {
    time: '09:12',
    title: 'analyze payload synced',
    summary: 'CLI 已把最新构建结果注入 dashboard，全局状态已完成一次同步。',
    tone: 'live',
  },
  {
    time: '09:26',
    title: 'workspace shell extended',
    summary: '新增工作台、活动流、设计令牌三个页面骨架，后续能力可按路由继续扩展。',
    tone: 'default',
  },
  {
    time: '10:03',
    title: 'theme system unified',
    summary: '主题偏好收敛到应用根部，分析页和未来面板共享同一套明暗模式。',
    tone: 'default',
  },
]

export const diagnosticsQueue = [
  { label: 'CLI 注入链路', detail: '保留 `window.__WEAPP_VITE_ANALYZE_RESULT__` 兼容层。', status: '兼容' },
  { label: '路由拓展性', detail: '新增页面采用文件路由，后续新增面板不需要修改主路由表。', status: '可扩展' },
  { label: '组件复用', detail: '通用卡片与区块标题已独立，避免页面继续拷贝结构。', status: '已落地' },
  { label: '视觉令牌', detail: '颜色、表面、排版预览集中在 tokens 页面统一检查。', status: '可验证' },
]

export const tokenGroups = [
  {
    title: 'Accent',
    iconName: 'token-color' as const,
    tokens: [
      { name: '--dashboard-accent', sample: 'var(--dashboard-accent)' },
      { name: '--dashboard-accent-soft', sample: 'var(--dashboard-accent-soft)' },
      { name: '--dashboard-border-strong', sample: 'var(--dashboard-border-strong)' },
    ],
  },
  {
    title: 'Surfaces',
    iconName: 'token-surface' as const,
    tokens: [
      { name: '--dashboard-panel', sample: 'var(--dashboard-panel)' },
      { name: '--dashboard-panel-strong', sample: 'var(--dashboard-panel-strong)' },
      { name: '--dashboard-panel-muted', sample: 'var(--dashboard-panel-muted)' },
    ],
  },
  {
    title: 'Typography',
    iconName: 'token-type' as const,
    tokens: [
      { name: '--dashboard-text', sample: 'var(--dashboard-text)' },
      { name: '--dashboard-text-muted', sample: 'var(--dashboard-text-muted)' },
      { name: '--dashboard-text-soft', sample: 'var(--dashboard-text-soft)' },
    ],
  },
]
