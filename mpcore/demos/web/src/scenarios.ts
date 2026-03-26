import { createBrowserVirtualFiles } from '../../../packages/simulator/src/browser'

export interface BuiltInScenario {
  description: string
  files: ReturnType<typeof createBrowserVirtualFiles>
  id: string
  name: string
}

interface ScenarioMeta {
  description: string
  name: string
}

const scenarioCatalog: Record<string, ScenarioMeta> = {
  'commerce-shell': {
    name: 'Commerce Shell',
    description: 'TabBar + subpackage + relative jump + pageScrollTo，接近正常电商小程序结构。',
  },
  'ops-board': {
    name: 'Ops Board',
    description: '常规 Page / setData / redirectTo / pageNotFound 写法，适合验证数据更新与异常路由。',
  },
  'content-studio': {
    name: 'Content Studio',
    description: '编辑器 + 审核页 + 媒体分包，覆盖数组 patch、页面事件与 redirect/navigateTo 组合。',
  },
}

const rawScenarioModules = import.meta.glob('./fixtures/**/*', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>

function buildScenarioFiles(scenarioId: string) {
  const prefix = `./fixtures/${scenarioId}/`
  const entries = Object.entries(rawScenarioModules)
    .filter(([filePath]) => filePath.startsWith(prefix))
    .map(([filePath, content]) => [filePath.slice(prefix.length), content] as [string, string])

  return createBrowserVirtualFiles(entries)
}

export const builtInScenarios: BuiltInScenario[] = Object.entries(scenarioCatalog).map(([id, meta]) => ({
  id,
  name: meta.name,
  description: meta.description,
  files: buildScenarioFiles(id),
}))
