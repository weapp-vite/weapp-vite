import type { OutputOptions, RolldownLog } from 'rolldown'
import type { ConfigService } from '../config/types'
import path from 'pathe'
import { rolldown } from 'rolldown'
import { describe, expect, it } from 'vitest'
import { createSharedBuildOutput } from '../sharedBuildConfig'

function createFixture(isDev: boolean, preserveModules: boolean) {
  const root = path.resolve('issue-1263-fixture')
  const srcRoot = path.join(root, 'src')
  const entry = path.join(srcRoot, 'index.js')
  const shared = path.join(srcRoot, 'shared/value.js')
  const vendor = path.join(root, 'node_modules/example/dist/index-ABC12345.mjs')
  const sources = new Map([
    [entry, `import { value } from ${JSON.stringify(shared)}; import { vendor } from ${JSON.stringify(vendor)}; export const result = value + vendor`],
    [shared, 'export const value = "issue-1263:"'],
    [vendor, 'export const vendor = "result"'],
  ])
  const config = {
    cwd: root,
    absoluteSrcRoot: srcRoot,
    relativeAbsoluteSrcRoot: (id: string) => path.relative(srcRoot, id),
    isDev,
    weappViteConfig: {
      chunks: preserveModules ? { preserveModules: ['shared/**'] } : {},
    },
  } as unknown as ConfigService

  return { entry, sources, output: createSharedBuildOutput(config, () => []) }
}

async function generate(fixture: ReturnType<typeof createFixture>, output: OutputOptions) {
  const diagnostics: RolldownLog[] = []
  const bundle = await rolldown({
    input: fixture.entry,
    onLog(_level, log) {
      diagnostics.push(log)
    },
    plugins: [{
      name: 'issue-1263-memory-fixture',
      resolveId: id => fixture.sources.has(id) ? id : null,
      load: id => fixture.sources.get(id),
    }],
  })
  try {
    const result = await bundle.generate({ ...output, format: 'es' })
    return { diagnostics, output: result.output }
  }
  finally {
    await bundle.close()
  }
}

describe.each([false, true])('issue #1263 shared chunk diagnostics, development=%s', (isDev) => {
  it.each([false, true])('labels every group without changing output, preserved modules=%s', async (preserveModules) => {
    const fixture = createFixture(isDev, preserveModules)
    const labeled = await generate(fixture, fixture.output)
    const unlabeled = await generate(fixture, {
      ...fixture.output,
      codeSplitting: {
        groups: fixture.output.codeSplitting.groups.map(({ debugName: _debugName, ...group }) => group),
      },
    })

    expect(labeled.diagnostics.filter(log => log.code === 'MISSING_CODE_SPLITTING_GROUP_DEBUG_NAME')).toEqual([])
    expect(unlabeled.diagnostics.filter(log => log.code === 'MISSING_CODE_SPLITTING_GROUP_DEBUG_NAME'))
      .toHaveLength(fixture.output.codeSplitting.groups.length)
    expect(labeled.output).toEqual(unlabeled.output)
    expect(labeled.output.some(output => output.type === 'chunk' && output.exports.includes('result'))).toBe(true)
    if (preserveModules) {
      expect(labeled.output.some(output => output.fileName === 'shared/value.js')).toBe(true)
    }
  })
})
