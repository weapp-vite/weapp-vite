import { expect, it, vi } from 'vitest'
import { baselineHandoffFixture } from '../../../test/helpers/nativeVueBaselineHandoff/fixture'
import { compilerSourceId } from '../../plugins/compilerPlugin/hmr'
import { NativeVueTemplateBaselines } from './templateRegistration'

const admissionCases = [false, true].flatMap(dependency => (['Noop', 'Patch'] as const).flatMap(type => (['text', 'structure'] as const).map(edit => ({ dependency, type, edit }))))

it.each(admissionCases)('preserves published native script updates then admits template $edit $type before compilation (provider dependency=$dependency)', async ({ dependency, type, edit }) => {
  const commits = vi.spyOn(NativeVueTemplateBaselines.prototype, 'commit')
  const fallback = vi.spyOn(NativeVueTemplateBaselines.prototype, 'resolveFallback')
  const session = await baselineHandoffFixture('before-output', { declareCompilerDependency: dependency })
  const sourceId = compilerSourceId(session.file)
  expect(session.host.ownsDependency(session.file)).toBe(dependency)
  expect(session.host.isNativeSource(session.file)).toBe(true)
  expect(session.host.ownsRawSource(session.file)).toBe(true)
  expect(session.initial.templateRegistrationSignatures?.get(sourceId)).toEqual(expect.any(String))
  expect(commits.mock.calls.filter(([file]) => file === sourceId).at(-1)?.[1]).toBe(session.original)

  const script = session.original.replace('</script>', 'globalThis.__WEAPP_VITE_HMR_AUDIT__ = "native-script-update"\n</script>')
  for (const [index, source] of [script, session.original].entries()) {
    expect(await session.save(source, `native-script-${index}.js`)).toBe(true)
    await session.whenSettled()
    expect(session.freeze.mock.results.at(-1)?.value.sources.get(sourceId)).toBe(source)
    expect(session.host.readSource(session.file)).toBe(source)
    expect(commits.mock.calls.filter(([file]) => file === sourceId).at(-1)?.[1]).toBe(source)
    expect(session.classic).not.toHaveBeenCalled()
    expect(session.rebuild).not.toHaveBeenCalled()
  }
  expect(session.delta).toHaveBeenCalledTimes(2)

  session.freeze.mockClear()
  session.prepare.mockClear()
  session.rebuild.mockClear()
  fallback.mockClear()
  const template = edit === 'text'
    ? session.original.replace('<view>before</view>', '<view>after</view>')
    : session.original.replace('</template>', '<view hidden>native-template-update</view>\n</template>')
  expect(await session.save(template, 'native-template.js', ['entry-mixed-asset:1'], type)).toBe(false)
  await session.classicRequested

  expect(session.freeze).toHaveBeenCalledExactlyOnceWith([session.file])
  expect(session.freeze.mock.results.at(-1)?.value.sources.get(sourceId)).toBe(template)
  expect(fallback.mock.calls.at(-1)?.[0]).toContain(sourceId)
  expect(session.classic).toHaveBeenCalledOnce()
  expect(session.runtime.fallback).toMatchObject({ code: 'native-registration' })
  expect(session.prepare, 'known unsupported native template must fall back before provider preparation').not.toHaveBeenCalled()
  expect(session.rebuild, 'known unsupported native template must not compile a throwaway snapshot').not.toHaveBeenCalled()
  expect(session.delta).toHaveBeenCalledTimes(2)

  expect(await session.save(session.original, 'restore.js', ['entry-mixed-asset:1'], type)).toBe(false)
  expect(session.runtime.phase).toBe('classic')
  expect(session.classic).toHaveBeenCalledOnce()
  expect(session.freeze).toHaveBeenCalledOnce()
})

it.each([false, true].flatMap(dependency => (['Noop', 'Patch'] as const).map(type => ({ dependency, type }))))('hands an unknown published baseline directly to classic on the first $type (provider dependency=$dependency)', async ({ dependency, type }) => {
  const commits = vi.spyOn(NativeVueTemplateBaselines.prototype, 'commit')
  const session = await baselineHandoffFixture('during-output-write', { declareCompilerDependency: dependency })
  const sourceId = compilerSourceId(session.file)
  expect(session.host.ownsDependency(session.file)).toBe(dependency)
  expect(session.host.isNativeSource(session.file)).toBe(true)
  expect(session.host.readSource(session.file)).toBe(session.original)
  expect(session.initial.templateRegistrationSignatures?.get(sourceId)).toEqual(expect.any(String))
  expect(commits.mock.calls.filter(([file]) => file === sourceId)).toHaveLength(0)

  const changed = session.original.replace('</script>', 'globalThis.__WEAPP_VITE_HMR_AUDIT__ = "unknown-baseline"\n</script>')
  expect(await session.save(changed, 'unknown-baseline.js', ['entry-mixed-asset:1'], type)).toBe(false)
  await session.classicRequested
  expect(session.runtime.fallback).toMatchObject({ code: 'native-registration', files: [session.file] })
  expect(session.classic).toHaveBeenCalledOnce()
  expect(session.freeze).not.toHaveBeenCalled()
  expect(session.prepare).not.toHaveBeenCalled()
  expect(session.rebuild).not.toHaveBeenCalled()
  expect(session.delta).not.toHaveBeenCalled()
  expect(commits.mock.calls.filter(([file]) => file === sourceId)).toHaveLength(0)
})
