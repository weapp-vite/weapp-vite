import type { SidecarModuleRequest } from '../src/moduleGraph/protocol'
import { WEAPP_VITE_SIDECAR_RESOLVED_PREFIX } from '@weapp-core/constants'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { parseLogicalEntryId, parseSidecarModuleId, parseSidecarSourceRequest } from '../src/moduleGraph/protocol'
import { normalizeSourceId } from '../src/moduleGraph/traversal'
import { withRealpathScope } from '../src/utils/realpathScope'
import {
  layoutOwnerDependencies,
  layoutOwnerOutput,
  layoutOwnerPages,
  layoutOwnerSource,
  writeLayoutOwnerFixture,
  writeLayoutOwnerPageOrder,
} from './layoutSidecarOwnership/fixture'
import { createTempFixtureProject, createTestCompilerContext, getFixture } from './utils'

interface RawSourceMap {
  version: number
  sources: string[]
  sourcesContent: Array<string | null>
}

function readRawSourceMap(content: string): RawSourceMap {
  const map: unknown = JSON.parse(content)
  if (!map || typeof map !== 'object') {
    throw new TypeError('Expected a source map object')
  }
  const candidate = map as Partial<RawSourceMap>
  if (candidate.version !== 3
    || !Array.isArray(candidate.sources) || !candidate.sources.every(source => typeof source === 'string')
    || !Array.isArray(candidate.sourcesContent) || !candidate.sourcesContent.every(source => source === null || typeof source === 'string')
    || candidate.sources.length !== candidate.sourcesContent.length) {
    throw new TypeError('Expected complete raw sources and sourcesContent')
  }
  return candidate as RawSourceMap
}

function readSpecifier(value: string) {
  const specifier: unknown = JSON.parse(value)
  if (typeof specifier !== 'string') {
    throw new TypeError('Expected a string module specifier')
  }
  return specifier
}

function readWrapperSidecars(code: string) {
  return [...code.matchAll(/^import (".*");$/gm)]
    .map(match => parseSidecarModuleId(readSpecifier(match[1]!)))
    .filter((sidecar): sidecar is SidecarModuleRequest => Boolean(sidecar))
}

function readMapSidecars(map: RawSourceMap) {
  return map.sources.flatMap((source, index) => {
    // Rolldown 会为虚拟模块附加相对目录，甚至可能包含当前 package 的路径；
    // 从稳定协议前缀开始解析，避免让 cwd 影响 sidecar 识别。
    const protocolStart = source.indexOf(WEAPP_VITE_SIDECAR_RESOLVED_PREFIX)
    const sidecar = parseSidecarModuleId(protocolStart >= 0
      ? source.slice(protocolStart)
      : source.replace(/^(?:\.\.\/)+/, ''))
    if (!sidecar) {
      return []
    }
    const content = map.sourcesContent[index]
    expect(typeof content, source).toBe('string')
    const statements = /^import (".*");\nexport default (".*");\n$/.exec(content!)
    expect(statements, source).not.toBeNull()
    expect(parseSidecarSourceRequest(readSpecifier(statements![1]!)), source).toEqual({
      ...sidecar,
      ...(sidecar.kind === 'style' ? { dependencyOnly: true } : {}),
    })
    expect(readSpecifier(statements![2]!), source).toBe(sidecar.sourceId)
    return [sidecar]
  })
}

function expectedSidecars(root: string) {
  return withRealpathScope(() => {
    const ownerId = normalizeSourceId(path.join(root, layoutOwnerSource))
    return layoutOwnerDependencies.map(({ kind, source }) => ({
      kind,
      ownerId,
      sourceId: normalizeSourceId(path.join(root, source)),
    }))
  })
}

function sortedSidecars(sidecars: Array<{ kind: string, ownerId: string, sourceId: string }>) {
  return sidecars.toSorted((a, b) => `${a.kind}:${a.sourceId}`.localeCompare(`${b.kind}:${b.sourceId}`))
}

async function assertNativeOutput(outDir: string) {
  for (const entry of [
    ...layoutOwnerPages,
    layoutOwnerOutput,
    ...['own-card', 'first-card', 'second-card'].map(name => `components/${name}/index`),
  ]) {
    for (const extension of ['js', 'json', 'wxml', 'wxss']) {
      const content = await fs.readFile(path.join(outDir, `${entry}.${extension}`), 'utf8')
      expect(content.length, `${entry}.${extension}`).toBeGreaterThan(0)
    }
  }
  const layoutJson = await fs.readJSON(path.join(outDir, `${layoutOwnerOutput}.json`)) as {
    component: boolean
    usingComponents: Record<string, string>
  }
  expect(layoutJson.component).toBe(true)
  expect(layoutJson.usingComponents).toEqual({ 'own-card': '/components/own-card/index' })
  expect(await fs.readFile(path.join(outDir, `${layoutOwnerOutput}.wxml`), 'utf8')).toContain('<own-card')
  expect(await fs.readFile(path.join(outDir, 'shared/layout-body.wxml'), 'utf8')).toContain('layout-own-template')
  expect(await fs.readFile(path.join(outDir, 'components/own-card/index.wxml'), 'utf8')).toContain('own-card-marker')
  for (const name of ['first', 'second']) {
    const pageJson: unknown = await fs.readJSON(path.join(outDir, `pages/${name}/index.json`))
    expect(pageJson).toMatchObject({
      navigationBarTitleText: `Parent ${name}`,
      usingComponents: {
        'parent-card': `/components/${name}-card/index`,
        'weapp-layout-default': '/layouts/default/index',
      },
    })
    const template = await fs.readFile(path.join(outDir, `pages/${name}/index.wxml`), 'utf8')
    expect(template).toContain(`parent-${name}`)
    expect(template).toContain('<weapp-layout-default')
  }
  const appJson = await fs.readJSON(path.join(outDir, 'app.json')) as { pages: string[] }
  expect(appJson.pages.toSorted()).toEqual(layoutOwnerPages.toSorted())
}

describe('native layout sidecar ownership in real builds', { concurrent: false }, () => {
  it('keeps own logical imports and every raw map sidecar stable across parents and repeated builds', async () => {
    const project = await createTempFixtureProject(getFixture('wxml-remove'), 'layout-sidecar-ownership')
    const snapshots: Array<{ wrapper: string, rawMap: string }> = []
    vi.stubEnv('WEAPP_VITE_NATIVE', '0')
    try {
      await writeLayoutOwnerFixture(project.tempDir)
      const expected = sortedSidecars(expectedSidecars(project.tempDir))
      const owner = expected[0]!.ownerId
      for (const pages of [layoutOwnerPages, layoutOwnerPages.toReversed()]) {
        await writeLayoutOwnerPageOrder(project.tempDir, pages)
        for (const phase of ['first', 'repeat']) {
          // 对齐完整 CLI 的首次/重复构建：复用工程路径和输出，各次创建独立编译上下文。
          const wrappers: string[] = []
          const compiler = await createTestCompilerContext({
            cwd: project.tempDir,
            mode: 'production',
            isDev: false,
            inlineConfig: {
              plugins: [{
                name: 'layout-sidecar-ownership-contract',
                enforce: 'post',
                transform(code, id) {
                  const entry = parseLogicalEntryId(id)
                  if (entry?.type === 'layout' && entry.sourceId === owner) {
                    wrappers.push(code)
                  }
                },
              }],
            },
          })
          try {
            await compiler.ctx.buildService.build({ skipNpm: true })
            expect(wrappers.length, `${pages.join(',')}:${phase}`).toBeGreaterThan(0)
            for (const wrapper of wrappers) {
              expect(sortedSidecars(readWrapperSidecars(wrapper))).toEqual(expected)
            }
            const outDir = compiler.ctx.configService.outDir
            await assertNativeOutput(outDir)
            const rawMap = await fs.readFile(path.join(outDir, `${layoutOwnerOutput}.js.map`), 'utf8')
            expect(sortedSidecars(readMapSidecars(readRawSourceMap(rawMap)))).toEqual(expected)
            snapshots.push({ wrapper: wrappers[0]!, rawMap })
          }
          finally {
            await compiler.dispose()
          }
        }
      }
      expect(snapshots).toHaveLength(4)
      // 四次构建使用同一临时路径，直接比较原始 map 字节，包括未映射的侧车元数据。
      for (const snapshot of snapshots.slice(1)) {
        expect(snapshot).toEqual(snapshots[0])
      }
    }
    finally {
      vi.unstubAllEnvs()
      await project.cleanup()
    }
  }, 120_000)
})
