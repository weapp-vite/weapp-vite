import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { createLogicalEntryId } from '../../../moduleGraph/protocol'
import { createModuleGraphService } from '../../../moduleGraph/service'
import { createLogicalEntryLoadHook } from './logicalEntry'

const findCssEntryMock = vi.hoisted(() => vi.fn())

vi.mock('../../../utils', () => ({
  findCssEntry: findCssEntryMock,
  findJsEntry: vi.fn(async () => ({ path: undefined })),
  findJsonEntry: vi.fn(async () => ({ path: undefined })),
  findTemplateEntry: vi.fn(async () => ({ path: undefined })),
  findVueEntry: vi.fn(async () => undefined),
  isTemplate: (id: string) => id.endsWith('.wxml'),
}))

it('shares path reads across dependency roles without retaining the next load symlink target', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'logical-entry-roles-'))
  const root = realpathSync.native(directory).replaceAll('\\', '/')
  const alias = `${root}/alias`
  const first = `${root}/first`
  const second = `${root}/second`
  const files = ['page.vue', 'page.json', 'page.css']
  const service = createModuleGraphService()
  try {
    for (const target of [first, second]) {
      mkdirSync(target)
      for (const file of files) {
        writeFileSync(`${target}/${file}`, '')
      }
    }
    symlinkSync(first, alias, 'junction')
    const owner = `${alias}/page.vue`
    const json = `${alias}/page.json`
    const style = `${alias}/page.css`
    findCssEntryMock.mockResolvedValue({ path: style, predictions: [style] })
    const state = {
      resolvedEntryMap: new Map(),
      loadEntry: vi.fn(),
      entriesMap: new Map([['page', { type: 'page', jsonPath: json }]]),
      ctx: {
        configService: {
          isDev: true,
          absoluteSrcRoot: alias,
          relativeAbsoluteSrcRoot: (id: string) => path.basename(id),
        },
        moduleGraphService: service,
      },
    }
    const native = vi.spyOn(realpathSync, 'native')
    const reads: unknown[] = []
    const replace = service.replaceEntryDependencies
    vi.spyOn(service, 'replaceEntryDependencies').mockImplementation((...args) => {
      const before = native.mock.calls.length
      replace(...args)
      reads.push(...native.mock.calls.slice(before).map(([file]) => file))
    })
    const hook = createLogicalEntryLoadHook(state as any)
    const context = { addWatchFile: vi.fn() } as any
    // 在启动本轮读取之前解析逻辑 ID；这里只观测七种角色的同步依赖替换成本。
    const id = createLogicalEntryId(owner, 'page')
    await hook.call(context, id)
    expect(reads).toHaveLength(files.length)
    expect(service.getEntryDependencies(`${first}/page.vue`)).toEqual([
      { kind: 'json', sourceId: `${first}/page.json` },
      { kind: 'script', sourceId: `${first}/page.vue` },
      { kind: 'style', sourceId: `${first}/page.css` },
    ])
    unlinkSync(alias)
    symlinkSync(second, alias, 'junction')
    reads.length = 0
    await hook.call(context, createLogicalEntryId(owner, 'page'))
    expect(reads).toHaveLength(files.length)
    expect(service.getEntryDependencies(`${second}/page.vue`)).toEqual([
      { kind: 'json', sourceId: `${second}/page.json` },
      { kind: 'script', sourceId: `${second}/page.vue` },
      { kind: 'style', sourceId: `${second}/page.css` },
    ])
  }
  finally {
    service.resetSession()
    vi.restoreAllMocks()
    rmSync(directory, { recursive: true, force: true })
  }
})
