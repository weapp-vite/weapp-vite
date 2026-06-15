/* eslint-disable no-console -- 此页面专门通过 console API 演示 forwardConsole。 */

type ConsoleLevel = 'debug' | 'log' | 'info' | 'warn' | 'error'

interface LogAction {
  key: string
  level: ConsoleLevel
  title: string
  description: string
  terminal: string
}

interface TimelineItem {
  id: number
  level: ConsoleLevel
  label: string
  time: string
  terminal: string
}

const logActions: LogAction[] = [
  {
    key: 'debug',
    level: 'debug',
    title: 'Debug',
    description: '输出调试细节，适合检查页面内部状态。',
    terminal: '[mini:debug] forward demo debug',
  },
  {
    key: 'log',
    level: 'log',
    title: 'Log',
    description: '输出普通事件，适合确认按钮与页面行为。',
    terminal: '[mini:log] forward demo click',
  },
  {
    key: 'info',
    level: 'info',
    title: 'Info',
    description: '输出结构化信息，适合观察对象序列化。',
    terminal: '[mini:info] forward demo payload',
  },
  {
    key: 'warn',
    level: 'warn',
    title: 'Warn',
    description: '输出警告，适合展示终端里的黄色告警流。',
    terminal: '[mini:warn] forward demo warning',
  },
  {
    key: 'error',
    level: 'error',
    title: 'Error',
    description: '输出错误，适合检查终端错误通道。',
    terminal: '[mini:error] forward demo error',
  },
]

const initialTimeline: TimelineItem[] = [
  {
    id: 0,
    level: 'info',
    label: '等待按钮触发',
    time: '--:--:--',
    terminal: '[mini:info] forward demo ready',
  },
]

Page({
  data: {
    title: 'Forward Console Lab',
    description: '在小程序里点击按钮，日志会通过 weapp.forwardConsole 映射回命令行。',
    actions: logActions,
    timeline: initialTimeline,
    activeLevel: 'info' as ConsoleLevel,
    eventCount: 0,
    lastTerminalLine: '[mini:info] forward demo ready',
    command: 'pnpm --filter forward-console-demo run dev:open',
    logsCommand: 'pnpm --filter forward-console-demo run ide:logs',
  },

  onLoad() {
    console.info('[forward-console-demo] page ready', {
      route: 'pages/index/index',
      forwardConsole: true,
    })
  },

  onEmitLog(event: WechatMiniprogram.CustomEvent<{ level: ConsoleLevel }>) {
    const level = event.currentTarget.dataset.level
    const action = this.data.actions.find(item => item.level === level)

    if (!action) {
      return
    }

    const nextCount = this.data.eventCount + 1
    const payload = {
      demo: 'forward-console-demo',
      level: action.level,
      count: nextCount,
      source: 'button',
    }

    this.printConsole(action.level, `[forward-console-demo] ${action.title} clicked`, payload)
    this.pushTimeline(action, nextCount)
  },

  onEmitBatch() {
    const nextCount = this.data.eventCount + 1

    console.log('[forward-console-demo] batch start', { count: nextCount })
    console.info('[forward-console-demo] batch payload', {
      route: 'pages/index/index',
      command: this.data.command,
    })
    console.warn('[forward-console-demo] batch warning', {
      reason: 'demo warning from batch button',
    })

    this.pushTimeline({
      key: 'batch',
      level: 'warn',
      title: 'Batch',
      description: '连续输出 log、info、warn 三条日志。',
      terminal: '[mini:log] batch start / [mini:info] batch payload / [mini:warn] batch warning',
    }, nextCount)
  },

  onEmitUnhandledError() {
    const nextCount = this.data.eventCount + 1
    const error = new Error(`forward console demo exception #${nextCount}`)

    setTimeout(() => {
      throw error
    }, 0)

    this.pushTimeline({
      key: 'exception',
      level: 'error',
      title: 'Exception',
      description: '触发未捕获异常，验证 unhandledErrors 转发。',
      terminal: '[mini:error] forward console demo exception',
    }, nextCount)
  },

  async onCopyCommand(event: WechatMiniprogram.CustomEvent<{ command: string }>) {
    const command = event.currentTarget.dataset.command

    if (!command) {
      return
    }

    try {
      await wx.setClipboardData({ data: command })
      wx.showToast({
        title: '已复制',
        icon: 'success',
        duration: 1200,
      })
    }
    catch {
      wx.showToast({
        title: '复制失败',
        icon: 'none',
      })
    }
  },

  printConsole(level: ConsoleLevel, message: string, payload: unknown) {
    if (level === 'debug') {
      console.debug(message, payload)
      return
    }

    if (level === 'log') {
      console.log(message, payload)
      return
    }

    if (level === 'info') {
      console.info(message, payload)
      return
    }

    if (level === 'warn') {
      console.warn(message, payload)
      return
    }

    console.error(message, payload)
  },

  pushTimeline(action: LogAction, nextCount: number) {
    const nextItem: TimelineItem = {
      id: Date.now(),
      level: action.level,
      label: `${action.title} 已触发`,
      time: this.formatTime(),
      terminal: action.terminal,
    }
    const timeline = [nextItem, ...this.data.timeline].slice(0, 6)

    this.setData({
      activeLevel: action.level,
      eventCount: nextCount,
      lastTerminalLine: action.terminal,
      timeline,
    })
  },

  formatTime() {
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const ss = String(now.getSeconds()).padStart(2, '0')

    return `${hh}:${mm}:${ss}`
  },
})
