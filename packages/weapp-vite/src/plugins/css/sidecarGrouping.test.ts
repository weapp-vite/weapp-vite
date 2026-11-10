import type { RolldownOutput } from 'rolldown'
import type { CompilerContext } from '../../context'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { replaceEntryStyleImports } from '../../runtime/cssSidecarOwnership'
import { createRuntimeState } from '../../runtime/runtimeState'
import { css } from '../css'

it('bounds sidecar path resolution across owners and refreshes ownership for the next build', async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-sidecar-grouping-')))
  const src = path.join(root, 'src')
  const runtimeState = createRuntimeState()
  const input: Record<string, string> = {}
  const resolutions = new Map<string, number>()
  const count = 8
  const ctx = {
    runtimeState,
    scanService: { subPackageMap: new Map() },
    configService: {
      cwd: root,
      absoluteSrcRoot: src,
      isDev: true,
      platform: 'weapp',
      outputExtensions: { wxss: 'wxss', wxml: 'wxml' },
      relativeOutputPath(file: string) {
        const normalized = path.normalize(file)
        resolutions.set(normalized, (resolutions.get(normalized) ?? 0) + 1)
        return path.relative(src, file).replaceAll('\\', '/')
      },
      relativeAbsoluteSrcRoot: (file: string) => path.relative(src, file).replaceAll('\\', '/'),
    },
  } as unknown as CompilerContext
  const render = async () => {
    resolutions.clear()
    return await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: css(ctx),
      build: {
        write: false,
        minify: false,
        cssMinify: false,
        rolldownOptions: { input, output: { format: 'es', entryFileNames: '[name].js' } },
      },
    }) as RolldownOutput
  }
  const styles = (output: RolldownOutput) => new Map(output.output.flatMap(asset =>
    asset.type === 'asset' && /\.(?:wxss|acss)$/.test(asset.fileName) ? [[asset.fileName, String(asset.source)] as const] : [],
  ))
  try {
    for (let index = 0; index < count; index++) {
      const directory = path.join(src, `pages/page-${index}`)
      await mkdir(directory, { recursive: true })
      const owner = path.join(directory, 'index.js')
      const sidecar = path.join(directory, 'index.wxss')
      input[`pages/page-${index}/index`] = owner
      await writeFile(owner, 'import "./imported.css"; export const value = 1')
      await writeFile(path.join(directory, 'imported.css'), `.imported-${index} { color: red; }`)
      await writeFile(sidecar, `.native-${index} { display: block; }`)
      replaceEntryStyleImports(runtimeState.css, owner, [sidecar])
    }
    const output = styles(await render())
    for (let index = 0; index < count; index++) {
      const content = output.get(`pages/page-${index}/index.wxss`)
      expect(content).toContain(`.imported-${index}`)
      expect(content?.match(new RegExp(`\\.native-${index}`, 'g'))).toHaveLength(1)
      // 每个 sidecar 的路径处理应有固定上界，不能随页面数量重复扫描。
      const sidecarResolutions = resolutions.get(path.join(src, `pages/page-${index}/index.wxss`))
      expect(sidecarResolutions).toBeGreaterThan(0)
      expect(sidecarResolutions).toBeLessThanOrEqual(4)
    }
    const retiredOwner = path.join(src, 'pages/page-0/index.js')
    replaceEntryStyleImports(runtimeState.css, retiredOwner, [])
    await writeFile(path.join(src, 'pages/page-1/index.wxss'), '.updated-native { display: flex; }')
    const next = styles(await render())
    expect(next.get('pages/page-0/index.wxss')).toContain('.imported-0')
    expect(next.get('pages/page-0/index.wxss')).not.toContain('.native-0')
    expect(next.get('pages/page-1/index.wxss')).toContain('.updated-native')
    expect(next.get('pages/page-1/index.wxss')).not.toContain('.native-1')
    ctx.configService.outputExtensions.wxss = 'acss'
    const retargeted = styles(await render())
    expect(retargeted.get('pages/page-0/index.acss')).toContain('.imported-0')
    expect(retargeted.get('pages/page-1/index.acss')).toContain('.updated-native')
    expect(retargeted.has('pages/page-1/index.wxss')).toBe(false)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
