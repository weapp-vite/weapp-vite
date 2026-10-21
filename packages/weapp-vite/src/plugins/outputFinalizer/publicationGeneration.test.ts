import type { EmittedAsset, RolldownOutput } from 'rolldown'
import type { CompilerContext } from '../../context'
import path from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../../runtime/runtimeState'
import { createOutputPublicationPlugin } from './publication'

const { prepare, validate } = vi.hoisted(() => ({
  prepare: vi.fn(() => async () => {}),
  validate: vi.fn(async () => undefined),
}))

vi.mock('./ownership', () => ({ prepareOutputPublicationOwnership: prepare }))
vi.mock('../../wxml/validate', () => ({ validateWxmlBundle: validate }))
vi.mock('../asset/publication', () => ({
  createPublicAssetPublication: () => ({ configure() {}, start() {}, async emit() {}, async commit() {} }),
}))

function handler(hook: any) {
  return typeof hook === 'function' ? hook : hook?.handler
}

function fixture() {
  const root = path.resolve('publication-generation-fixture')
  const ctx = {
    configService: { isDev: true },
    runtimeState: createRuntimeState(),
    scanService: { independentSubPackageMap: new Map([['pkg', {}]]) },
  } as CompilerContext
  const plugin = createOutputPublicationPlugin(ctx)
  const emitted: EmittedAsset[] = []
  const hookContext = {
    meta: { watchMode: false },
    warn() {},
    addWatchFile() {},
    emitFile(asset: EmittedAsset) {
      emitted.push(asset)
    },
  }
  handler(plugin.configResolved)({ root, build: { outDir: 'dist' } })
  const output: RolldownOutput = {
    output: ['js', 'json', 'wxml'].map(extension => ({
      type: 'asset',
      fileName: `pkg/components/optional/index.${extension}`,
      source: extension,
      names: [],
      originalFileNames: [],
    })),
  }
  const names = output.output.map(item => item.fileName)
  const generate = () => handler(plugin.generateBundle).call(hookContext, {}, {}, true)
  const expectOwnership = () => {
    expect(prepare).toHaveBeenCalledWith(ctx, path.join(root, 'dist'), expect.objectContaining({ independentOutputNames: names }))
  }
  return { ctx, output, names, emitted, generate, expectOwnership }
}

describe('independent publication generation ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validate.mockResolvedValue(undefined)
  })

  it('keeps an unchanged child generation owned when a later event invalidates its cache during validation', async () => {
    const { ctx, output, generate, expectOwnership } = fixture()
    ctx.runtimeState.build.independent.outputs.set('pkg', output)
    const validation = Promise.withResolvers<undefined>()
    validate.mockImplementationOnce(() => validation.promise)
    const publication = generate()
    expect(validate).toHaveBeenCalledOnce()

    ctx.runtimeState.build.independent.outputs.delete('pkg')
    validation.resolve(undefined)
    await publication

    expectOwnership()
  })

  it.each([true, false])('owns the child files actually emitted after asynchronous flush, initially cached: %s', async (cached) => {
    const { ctx, output, names, emitted, generate, expectOwnership } = fixture()
    if (cached) {
      ctx.runtimeState.build.independent.outputs.set('pkg', output)
    }
    const child = Promise.withResolvers<RolldownOutput>()
    ctx.runtimeState.build.independent.pendingOutputs = [child.promise]
    const publication = generate()
    await vi.waitFor(() => expect(ctx.runtimeState.build.independent.pendingOutputs).toHaveLength(0))

    ctx.runtimeState.build.independent.outputs.delete('pkg')
    child.resolve(output)
    await publication

    expect(emitted.map(asset => asset.fileName)).toEqual(names)
    expectOwnership()
  })
})
