export interface DashboardLabTimelineItem {
  time: string
  title: string
  detail: string
}

export function createDashboardLabTimeline(scope: string): DashboardLabTimelineItem[] {
  return [
    {
      time: 'dev',
      title: `${scope} dev ui`,
      detail: '通过 wv dev --ui 打开 dashboard 实时模式。',
    },
    {
      time: 'build',
      title: `${scope} build ui`,
      detail: '通过 wv build --ui 验证一次性 analyze payload。',
    },
    {
      time: 'inspect',
      title: `${scope} inspect views`,
      detail: '检查首页、分析页、活动流、tokens 和主题切换。',
    },
  ]
}
