import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { chunkExtraCases, chunkMatrixCases, selectIdeRuntimeChunkExtraCases, selectIdeRuntimeChunkMatrixCases } from '../../chunk-modes.matrix'
import { getIdeExhaustiveTasks, getIdeHeadlessTasks } from '../e2e-suite-manifest'
import { ACCEPTANCE_ROOT } from './helpers'
import { analyzeCaseSource, readCaseInventory, readFactoryTitle } from './inventoryAnalyzer'
import { collectInventorySources } from './inventorySources'

function readTaskCases(root: string, label: string, templates?: string[]) {
  const file = `e2e/${label}`
  const cases = readCaseInventory(root, file, templates)
  const title = readFactoryTitle(fs.readFileSync(path.join(root, file), 'utf8'), file, 'createChunkModesRuntimeSuite')
  if (typeof title !== 'string') {
    return cases
  }
  const runtimeCases = label.includes('.extras.')
    ? selectIdeRuntimeChunkExtraCases(chunkExtraCases)
    : selectIdeRuntimeChunkMatrixCases(chunkMatrixCases).filter(item => item.strategy === (label.includes('.duplicate.') ? 'duplicate' : 'hoist'))
  const factory = 'e2e/ide/chunk-modes.runtime.shared.ts'
  return analyzeCaseSource(fs.readFileSync(path.join(root, factory), 'utf8'), factory, [], { suiteName: title, runtimeCases })
    .map(item => ({ ...item, notes: [...item.notes, 'Chunk routes are selected by withIdeSmokeRoutes in e2e/ide/chunk-modes.runtime.shared.ts'] }))
}

export function createDomAcceptanceInventory(root = ACCEPTANCE_ROOT) {
  const headlessLabels = new Set(getIdeHeadlessTasks().map(task => task.label))
  const tasks = getIdeExhaustiveTasks().map(task => ({
    task: task.label,
    scope: task.outOfScopeReason ? 'out-of-scope' : 'wechat',
    reason: task.outOfScopeReason ?? null,
    providers: task.outOfScopeReason ? ['swan'] : headlessLabels.has(task.label) ? ['devtools', 'headless'] : ['devtools'],
    templates: task.acceptanceTemplates ?? [],
    cases: readTaskCases(root, task.label, task.acceptanceTemplates),
  }))
  const wechat = tasks.filter(task => task.scope === 'wechat')
  const cases = wechat.flatMap(task => task.cases)
  return {
    schemaVersion: 1,
    kind: 'static-plan-inventory',
    summary: {
      taskCount: tasks.length,
      wechatTaskCount: wechat.length,
      outOfScopeTaskCount: tasks.length - wechat.length,
      expandedCaseDeclarations: cases.length,
      casesWithPlan: cases.filter(item => item.plans.length).length,
      casesMissingPlan: cases.filter(item => !item.plans.length).length,
      unresolvedParameterizations: cases.filter(item => item.notes.some(note => note.startsWith('Dynamic'))).length,
      tasksWithoutCaseDeclarations: wechat.filter(task => !task.cases.length).length,
    },
    tasks,
    sources: collectInventorySources(root, [
      ...tasks.map(task => `e2e/${task.task}`),
      'e2e/scripts/e2e-suite-manifest.ts',
      'e2e/scripts/domAcceptanceReport/inventory.ts',
    ]),
  }
}

function cell(value: string) {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ').replaceAll('`', '\\`')
}

export function renderDomAcceptanceInventory(inventory: ReturnType<typeof createDomAcceptanceInventory>) {
  const lines = [
    '# 微信 IDE DOM 验收清单',
    '',
    '本文件由 `e2e/scripts/domAcceptanceReport/inventory.ts` 从 exhaustive manifest 和 TypeScript AST 生成。它记录源码中的计划接入情况，不代表运行通过。最终验收以同一提交的严格 IDE JSON 报告为准。',
    '',
    '字面量参数表与模板 runner 子任务已展开；动态表会显式标注。一个 case 内的多路由操作保留在 routes/operations；模板的完整 route/checkpoint 定义见 plan source。GitHub aggregate 的直接测试导入递归展开。',
    '',
    'JSON 中的 sources 保存测试和本地 E2E 依赖的 SHA-256；修改共享计划、helper 或 manifest 后，CI 会要求重新生成清单。',
    '',
    `- 任务：${inventory.summary.taskCount}；微信：${inventory.summary.wechatTaskCount}；范围外：${inventory.summary.outOfScopeTaskCount}。`,
    `- 展开的 case 声明：${inventory.summary.expandedCaseDeclarations}；已接入计划：${inventory.summary.casesWithPlan}；缺计划：${inventory.summary.casesMissingPlan}。`,
    `- 未解析的动态参数化：${inventory.summary.unresolvedParameterizations}；未发现 case 声明的微信任务：${inventory.summary.tasksWithoutCaseDeclarations}。`,
    '',
    '重新生成：`node --import tsx e2e/scripts/domAcceptanceReport/inventory.ts --write`。',
    '',
    '## 任务覆盖',
    '',
    '| Task | Providers | Cases | Plans | Missing | Scope |',
    '| --- | --- | ---: | ---: | ---: | --- |',
  ]
  for (const task of inventory.tasks) {
    lines.push(`| ${task.task} | ${task.providers.join(', ')} | ${task.cases.length} | ${task.cases.filter(item => item.plans.length).length} | ${task.scope === 'wechat' ? task.cases.filter(item => !item.plans.length).length : '-'} | ${task.scope} |`)
  }
  for (const task of inventory.tasks) {
    lines.push('', `## ${task.task}`, '')
    if (task.reason) {
      lines.push(task.reason, '')
    }
    if (!task.cases.length) {
      lines.push('未静态发现 case；严格 reporter 必须在执行收集后确认非空。', '')
    }
    for (const item of task.cases) {
      lines.push(`### ${cell(item.name)}`, '', `- Source: \`${item.source}\``, `- Plan: ${item.plans.length ? 'registered in source; runtime verification required' : 'MISSING'}`)
      for (const plan of item.plans) {
        lines.push(`- Registration: \`${plan.registration}\`; fixture: \`${cell(plan.fixture)}\`; checkpoints: \`${cell(plan.checkpoints)}\`; source: \`${plan.source}\``)
      }
      if (item.routes.length) {
        lines.push(`- Routes: ${item.routes.map(route => `\`${cell(route)}\``).join(', ')}`)
      }
      if (item.operations.length) {
        lines.push(`- Operations: ${item.operations.map(operation => `\`${cell(operation)}\``).join(', ')}`)
      }
      for (const note of item.notes) {
        lines.push(`- ${note}`)
      }
      lines.push('')
    }
  }
  return `${lines.join('\n')}\n`
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const inventory = createDomAcceptanceInventory()
  if (process.argv.includes('--write')) {
    fs.writeFileSync(path.join(ACCEPTANCE_ROOT, 'e2e/dom-acceptance-inventory.json'), `${JSON.stringify(inventory, null, 2)}\n`)
    fs.writeFileSync(path.join(ACCEPTANCE_ROOT, 'e2e/dom-acceptance-inventory.md'), renderDomAcceptanceInventory(inventory))
  }
  if (process.argv.includes('--check')) {
    const saved: unknown = JSON.parse(fs.readFileSync(path.join(ACCEPTANCE_ROOT, 'e2e/dom-acceptance-inventory.json'), 'utf8'))
    if (JSON.stringify(saved) !== JSON.stringify(inventory)) {
      throw new Error('DOM case inventory is stale; regenerate with --write after editing IDE cases or plans')
    }
  }
  console.log(JSON.stringify(inventory.summary, null, 2))
}
