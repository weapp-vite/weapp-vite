import type { ResolvedConfig } from 'vite'
import type { CompilerContext } from '../context'
import { EventEmitter } from 'node:events'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { describe, expect, it, vi } from 'vitest'
import { createAutoImportService } from '../runtime/autoImport/service'
import { createRuntimeState } from '../runtime/runtimeState'
import { autoImport } from './autoImport'

const chokidarWatchMock = vi.hoisted(() => vi.fn())

vi.mock('chokidar', () => ({
  default: { watch: chokidarWatchMock },
}))

function hook<T extends (...args: never[]) => unknown>(value: T | { handler: T } | undefined): T {
  if (!value) {
    throw new Error('Expected plugin hook')
  }
  return typeof value === 'function' ? value : value.handler
}

describe('auto import component path identity', () => {
  it.each(['sidecar', 'native'] as const)('keeps scan and %s events on one registry identity across path separators', async (owner) => {
    const root = path.normalize(await realpath(await mkdtemp(path.join(tmpdir(), 'auto-import-path-'))))
    const component = path.join(root, 'components/Card.vue')
    const watcher = new EventEmitter()
    chokidarWatchMock.mockReturnValue(watcher)
    // 使用真实注册表，只补齐当前插件与服务访问的编译上下文字段。
    const ctx = {
      configService: {
        cwd: root,
        absoluteSrcRoot: root,
        relativeCwd: (file: string) => path.relative(root, file),
        relativeAbsoluteSrcRoot: (file: string) => path.relative(root, file),
        relativeSrcRoot: (file: string) => file,
        isDev: owner === 'sidecar',
        weappViteConfig: {
          autoImportComponents: {
            globs: ['components/**/*.vue'],
            output: false,
            typedComponents: false,
            htmlCustomData: false,
            vueComponents: false,
          },
        },
      },
      jsonService: {
        read: async (file: string) => JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>,
      },
      runtimeState: createRuntimeState(),
    } as unknown as CompilerContext
    const service = createAutoImportService(ctx)
    ctx.autoImportService = service
    const plugin = autoImport(ctx)[0]!
    const buildStart = hook(plugin.buildStart)
    // 这些钩子不读取构建参数，只使用 addWatchFile。
    const pluginContext = { addWatchFile() {} } as ThisParameterType<typeof buildStart>
    const buildOptions = {} as Parameters<typeof buildStart>[0]
    const config = { build: { outDir: 'dist' } } as ResolvedConfig
    const eventPath = component.replaceAll('/', '\\')
    const source = '<template><view>card</view></template>'
    async function notify(event: 'add' | 'change' | 'unlink') {
      if (owner === 'sidecar') {
        watcher.emit(event, eventPath)
      }
      else {
        await hook(plugin.watchChange).call(pluginContext, `${eventPath}?watch`, {
          event: event === 'add' ? 'create' : event === 'unlink' ? 'delete' : 'update',
        })
      }
      await service.awaitManifestWrites()
    }

    try {
      await mkdir(path.dirname(component), { recursive: true })
      await writeFile(component, source)
      hook(plugin.configResolved)(config)
      await buildStart.call(pluginContext, buildOptions)
      expect(service.resolve('Card')?.value.resolvedId).toBe(component)

      await rm(component)
      await notify('unlink')
      expect(service.resolve('Card')).toBeUndefined()

      await writeFile(component, source)
      await notify('add')
      expect(service.resolve('Card')?.value).toEqual({
        name: 'Card',
        from: '/components/Card',
        resolvedId: component,
      })

      await writeFile(component, `${source}<json>{ "component": false }</json>`)
      await notify('change')
      expect(service.resolve('Card')).toBeUndefined()
    }
    finally {
      await service.awaitManifestWrites()
      watcher.removeAllListeners()
      await rm(root, { recursive: true, force: true })
    }
  })
})
