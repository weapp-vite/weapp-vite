import type { DevHotkeyDefinition, DevHotkeyGroup } from './types'
import { runDevRebuildAction, runDevtoolsCacheAction, runOpenIdeAction } from './devtools'
import { runScreenshotAction } from './screenshot'

export interface DevHotkeyGroupDefinition {
  key: DevHotkeyGroup
  title: string
}

export const DEV_HOTKEY_GROUPS: readonly DevHotkeyGroupDefinition[] = [
  { key: 'development', title: '开发动作' },
  { key: 'devtools', title: 'DevTools 动作' },
  { key: 'process', title: '进程控制' },
  { key: 'help', title: '帮助' },
]

export const DEV_HOTKEY_DEFINITIONS: readonly DevHotkeyDefinition[] = [
  {
    description: '截图当前页面并保存到本地',
    group: 'development',
    key: 's',
    label: '截图',
    pendingLabel: '正在截图当前页面',
    run: async ({ options }) => {
      const screenshotPath = await runScreenshotAction(options)
      return `截图已保存到 ${screenshotPath}`
    },
  },
  {
    description: '手动重新构建当前小程序产物',
    group: 'development',
    key: 'r',
    label: '手动重新构建',
    pendingLabel: '正在手动重新构建当前小程序产物',
    run: async ({ options }) => {
      return await runDevRebuildAction(options)
    },
  },
  {
    description: '清理微信开发者工具 compile 缓存',
    group: 'devtools',
    key: 'c',
    label: '清理 compile 缓存',
    pendingLabel: '正在清理微信开发者工具 compile 缓存',
    run: async ({ options }) => {
      return await runDevtoolsCacheAction(options, 'compile')
    },
  },
  {
    description: '清理微信开发者工具全部缓存',
    group: 'devtools',
    key: 'C',
    label: '清理全部缓存',
    pendingLabel: '正在清理微信开发者工具全部缓存',
    run: async ({ options }) => {
      return await runDevtoolsCacheAction(options, 'all')
    },
  },
  {
    description: '重新打开当前微信开发者工具项目',
    group: 'devtools',
    key: 'o',
    label: '重新打开微信开发者工具',
    pendingLabel: '正在重新打开微信开发者工具项目',
    run: async ({ options }) => {
      return await runOpenIdeAction(options)
    },
  },
  {
    description: '开关 MCP 服务',
    group: 'devtools',
    key: 'm',
    label: 'MCP 切换',
    run: async ({ toggleMcp }) => {
      return await toggleMcp()
    },
  },
  {
    description: '退出当前 dev',
    group: 'process',
    key: 'q',
  },
  {
    description: '强制中断当前 dev',
    group: 'process',
    key: 'Ctrl+C',
  },
  {
    description: '暂时挂起当前 dev，恢复终端控制',
    group: 'process',
    key: 'Ctrl+Z',
  },
  {
    description: '重新显示这份帮助',
    group: 'help',
    key: 'h',
  },
]

export function resolveDevHotkeyRowsByGroup() {
  return DEV_HOTKEY_GROUPS.map(group => ({
    key: group.key,
    rows: DEV_HOTKEY_DEFINITIONS.filter(action => action.group === group.key),
    title: group.title,
  }))
}

export function resolveRunnableHotkeyDefinition(input: string) {
  return DEV_HOTKEY_DEFINITIONS.find(action => action.run && action.key === input)
}
