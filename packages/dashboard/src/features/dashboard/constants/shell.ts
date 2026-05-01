import type {
  DashboardIconFeatureItem,
  DashboardNavItem,
  DashboardRuntimeEvent,
  DashboardTokenGroup,
  WorkspaceActivityItem,
  WorkspaceCommandItem,
  WorkspaceDiagnosticItem,
} from '../types'
import { dashboardTabs } from './view'

export const workspaceNavigation: DashboardNavItem[] = [
  { to: '/', label: '工作台', caption: '应用入口与状态总览', iconName: 'nav-home' },
  {
    to: '/analyze',
    label: '分析视图',
    caption: '包体、模块与分包结构',
    iconName: 'nav-analyze',
    children: dashboardTabs.map(tab => ({
      to: tab.key === 'overview' ? '/analyze' : `/analyze?tab=${tab.key}`,
      label: tab.label,
      caption: tab.key === 'overview'
        ? '全局摘要和建议动作'
        : tab.key === 'diagnostics'
          ? '预算、增量和历史基线'
          : tab.key === 'review'
            ? 'PR 风险和评审清单'
            : tab.key === 'treemap'
              ? '产物体积地图'
              : tab.key === 'files'
                ? '文件、预算和模块明细'
                : tab.key === 'source'
                  ? '源码与产物 Diff'
                  : tab.key === 'packages'
                    ? '包体和产物列表'
                    : '模块复用与来源',
      iconName: tab.iconName,
    })),
  },
  { to: '/activity', label: '活动流', caption: '命令、诊断与运行事件', iconName: 'nav-activity' },
  { to: '/tokens', label: '设计令牌', caption: '主题、表面与组件状态', iconName: 'nav-tokens' },
]

export const workspaceHighlights: DashboardIconFeatureItem[] = [
  {
    title: 'Workspace Readiness',
    description: '工作台、分析、活动流和令牌检查各有独立入口。',
    iconName: 'hero-workspace' as const,
    eyebrow: 'Structure',
  },
  {
    title: 'Command Surface',
    description: '常用 dev、build、analyze 命令集中呈现并支持复制。',
    iconName: 'hero-commands' as const,
    eyebrow: 'Action',
  },
  {
    title: 'System Language',
    description: '统一表面、状态徽标、列表密度和明暗主题。',
    iconName: 'hero-system' as const,
    eyebrow: 'Design',
  },
]

export const quickCommands: WorkspaceCommandItem[] = [
  { label: '启动开发', command: 'pnpm --filter @weapp-vite/dashboard dev', note: '本地预览完整 UI 壳子', category: 'dev' },
  { label: '生产构建', command: 'pnpm --filter @weapp-vite/dashboard build', note: '验证静态产物可发布', category: 'build' },
  { label: '主包联调', command: 'weapp-vite build --ui', note: '从 CLI 注入真实分析数据', category: 'analyze' },
]

export const releaseChecklist = [
  '`analyze` payload 契约保持兼容，CLI 注入无需迁移。',
  '工作台可在无 payload 状态下展示稳定空态和示例事件。',
  '主题偏好在应用级共享，页面之间状态一致。',
]

export const activityFeed: WorkspaceActivityItem[] = [
  {
    time: '09:12',
    title: 'analyze payload synced',
    summary: 'CLI 已把最新构建结果注入 dashboard，全局状态已完成一次同步。',
    tone: 'live',
  },
  {
    time: '09:26',
    title: 'workspace shell extended',
    summary: '工作台、活动流、设计令牌已经拆成独立页面。',
    tone: 'default',
  },
  {
    time: '10:03',
    title: 'theme system unified',
    summary: '主题偏好收敛到应用根部，所有页面共享同一套明暗模式。',
    tone: 'default',
  },
]

export const diagnosticsQueue: WorkspaceDiagnosticItem[] = [
  { label: 'CLI 注入链路', detail: '保留 `window.__WEAPP_VITE_ANALYZE_RESULT__` 兼容层。', status: '兼容' },
  { label: '路由拓展性', detail: '页面采用文件路由，主路由表保持稳定。', status: '可扩展' },
  { label: '组件复用', detail: '通用卡片与区块标题已独立，避免页面继续拷贝结构。', status: '已落地' },
  { label: '视觉令牌', detail: '颜色、表面、排版预览集中在 tokens 页面统一检查。', status: '可验证' },
]

export const sampleRuntimeEvents: DashboardRuntimeEvent[] = [
  {
    id: 'evt-command-build-ui',
    kind: 'command',
    level: 'success',
    title: 'build --ui completed',
    detail: '示例事件: dashboard 已经准备好承接来自 CLI 的真实命令生命周期事件。',
    timestamp: '10:18:12',
    source: 'cli',
    durationMs: 842,
    tags: ['build', 'ui'],
  },
  {
    id: 'evt-hmr-shell',
    kind: 'hmr',
    level: 'info',
    title: 'workspace shell hot updated',
    detail: '工作台页面已完成一次热更新并记录到事件流。',
    timestamp: '10:19:44',
    source: 'vite-hmr',
    tags: ['hmr', 'shell'],
  },
  {
    id: 'evt-diagnostic-payload',
    kind: 'diagnostic',
    level: 'warning',
    title: 'analyze payload pending',
    detail: '当前页面支持在没有 payload 时进入空态。',
    timestamp: '10:20:07',
    source: 'dashboard',
    tags: ['diagnostic'],
  },
]

export const tokenGroups: DashboardTokenGroup[] = [
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
