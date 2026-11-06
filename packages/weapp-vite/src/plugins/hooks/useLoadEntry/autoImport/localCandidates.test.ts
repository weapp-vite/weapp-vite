import type { CompilerContext } from '../../../../context'
import os from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLocalCandidateRegistrar } from './localCandidates'

const fixtures: string[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(fixtures.splice(0).map(root => fs.remove(root)))
})

async function createFixture(globs = ['components/**/*.vue']) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'local-candidate-'))
  fixtures.push(root)
  let version = 0
  const registerPotentialComponent = vi.fn(async (_file: string) => {})
  const service = {
    getVersion: () => version,
    registerPotentialComponent,
  }
  const config = {
    absoluteSrcRoot: root,
    weappViteConfig: { autoImportComponents: { globs } },
  }
  return {
    root,
    registerPotentialComponent,
    advanceVersion: () => { version += 1 },
    registrar: createLocalCandidateRegistrar(
      service as CompilerContext['autoImportService'],
      config as CompilerContext['configService'],
    ),
  }
}

describe('local candidate registration generations', () => {
  it('does not access compiler services during construction or clearing', () => {
    const service = new Proxy({}, {
      get() {
        throw new Error('service must stay idle')
      },
    }) as CompilerContext['autoImportService']
    const registrar = createLocalCandidateRegistrar(service)
    expect(() => registrar.clear()).not.toThrow()
    expect(() => registrar.clear()).not.toThrow()
  })

  it('does not read registry versions before configuration and registration gates pass', async () => {
    const getVersion = vi.fn(() => {
      throw new Error('version must stay idle')
    })
    const registrar = createLocalCandidateRegistrar({
      getVersion,
      registerPotentialComponent: vi.fn(),
    } as unknown as CompilerContext['autoImportService'])
    await expect(registrar.register(['view'])).resolves.toBe(false)
    const missingRegistration = createLocalCandidateRegistrar(
      { getVersion } as unknown as CompilerContext['autoImportService'],
      {} as CompilerContext['configService'],
    )
    await expect(missingRegistration.register(['view'])).resolves.toBe(false)
    const disabled = createLocalCandidateRegistrar(
      { getVersion, registerPotentialComponent: vi.fn() } as unknown as CompilerContext['autoImportService'],
      { weappViteConfig: { autoImportComponents: false } } as CompilerContext['configService'],
    )
    await expect(disabled.register(['view'])).resolves.toBe(false)
    expect(getVersion).not.toHaveBeenCalled()
  })

  it('coalesces concurrent and later probes and registrations for the same path', async () => {
    const fixture = await createFixture()
    const component = path.join(fixture.root, 'components/view.vue')
    await fs.outputFile(component, '<template><view /></template>')
    const probes = vi.spyOn(fs, 'pathExists')
    const outcomes = await Promise.all([
      fixture.registrar.register(['view']),
      fixture.registrar.register(['view']),
    ])
    expect(outcomes).toEqual([true, true])
    expect(fixture.registerPotentialComponent).toHaveBeenCalledExactlyOnceWith(component)
    expect(probes.mock.calls.filter(([file]) => file === component)).toHaveLength(1)

    await expect(fixture.registrar.register(['view'])).resolves.toBe(true)
    expect(fixture.registerPotentialComponent).toHaveBeenCalledOnce()
    expect(probes.mock.calls.filter(([file]) => file === component)).toHaveLength(1)
  })

  it('keeps distinct candidate names, roots and extensions independent', async () => {
    const fixture = await createFixture(['first/**/*.vue', 'second/**/*.vue', 'second/**/*.ts'])
    const components = [
      path.join(fixture.root, 'first/card.vue'),
      path.join(fixture.root, 'second/card.ts'),
      path.join(fixture.root, 'second/other.vue'),
    ]
    await Promise.all(components.map(file => fs.outputFile(file, 'component')))
    await fixture.registrar.register(['card', 'other'])
    expect(fixture.registerPotentialComponent.mock.calls.map(([file]) => file).sort()).toEqual(components.sort())
  })

  it('observes builtin-name component creation, deletion and restoration in following generations', async () => {
    const fixture = await createFixture()
    const component = path.join(fixture.root, 'components/view.vue')
    await expect(fixture.registrar.register(['view'])).resolves.toBe(false)
    await fs.outputFile(component, '<template><view /></template>')
    await expect(fixture.registrar.register(['view'])).resolves.toBe(false)

    fixture.registrar.clear()
    await expect(fixture.registrar.register(['view'])).resolves.toBe(true)
    expect(fixture.registerPotentialComponent).toHaveBeenCalledExactlyOnceWith(component)

    await fs.remove(component)
    fixture.registrar.clear()
    await expect(fixture.registrar.register(['view'])).resolves.toBe(false)
    expect(fixture.registerPotentialComponent).toHaveBeenCalledOnce()

    await fs.outputFile(component, '<template><view>restored</view></template>')
    fixture.registrar.clear()
    await expect(fixture.registrar.register(['view'])).resolves.toBe(true)
    expect(fixture.registerPotentialComponent).toHaveBeenCalledTimes(2)
  })

  it('invalidates negative probes when the registry version advances', async () => {
    const fixture = await createFixture()
    await expect(fixture.registrar.register(['card'])).resolves.toBe(false)
    const component = path.join(fixture.root, 'components/card.vue')
    await fs.outputFile(component, '<template><view /></template>')
    fixture.advanceVersion()
    await expect(fixture.registrar.register(['card'])).resolves.toBe(true)
    expect(fixture.registerPotentialComponent).toHaveBeenCalledExactlyOnceWith(component)
  })

  it('retries a failed registration without keeping a failed promise', async () => {
    const fixture = await createFixture()
    const component = path.join(fixture.root, 'components/card.vue')
    await fs.outputFile(component, '<template><view /></template>')
    fixture.registerPotentialComponent.mockRejectedValueOnce(new Error('registration failed'))
    await expect(fixture.registrar.register(['card'])).rejects.toThrow('registration failed')
    await expect(fixture.registrar.register(['card'])).resolves.toBe(true)
    expect(fixture.registerPotentialComponent).toHaveBeenCalledTimes(2)
  })

  it('retries a failed filesystem probe instead of treating it as a negative result', async () => {
    const fixture = await createFixture()
    const component = path.join(fixture.root, 'components/card.vue')
    await fs.outputFile(component, '<template><view /></template>')
    vi.spyOn(fs, 'pathExists').mockRejectedValueOnce(new Error('probe failed'))
    await expect(fixture.registrar.register(['card'])).rejects.toThrow('probe failed')
    await expect(fixture.registrar.register(['card'])).resolves.toBe(true)
    expect(fixture.registerPotentialComponent).toHaveBeenCalledExactlyOnceWith(component)
  })

  it('keeps candidate observations isolated between compiler owners', async () => {
    const first = await createFixture()
    const second = await createFixture()
    await expect(first.registrar.register(['view'])).resolves.toBe(false)
    const component = path.join(second.root, 'components/view.vue')
    await fs.outputFile(component, '<template><view /></template>')
    await expect(second.registrar.register(['view'])).resolves.toBe(true)
    expect(first.registerPotentialComponent).not.toHaveBeenCalled()
    expect(second.registerPotentialComponent).toHaveBeenCalledExactlyOnceWith(component)
  })

  it('does not let an old generation failure evict the next generation result', async () => {
    const fixture = await createFixture()
    const component = path.join(fixture.root, 'components/card.vue')
    await fs.outputFile(component, '<template><view /></template>')
    let rejectOld!: (error: Error) => void
    const oldRegistration = new Promise<void>((_resolve, reject) => {
      rejectOld = reject
    })
    fixture.registerPotentialComponent.mockImplementationOnce(() => oldRegistration)
    const previous = fixture.registrar.register(['card'])
    const previousFailure = expect(previous).rejects.toThrow('old generation')
    await vi.waitFor(() => expect(fixture.registerPotentialComponent).toHaveBeenCalledOnce())
    fixture.registrar.clear()
    await expect(fixture.registrar.register(['card'])).resolves.toBe(true)
    rejectOld(new Error('old generation'))
    await previousFailure
    await expect(fixture.registrar.register(['card'])).resolves.toBe(true)
    expect(fixture.registerPotentialComponent).toHaveBeenCalledTimes(2)
  })
})
