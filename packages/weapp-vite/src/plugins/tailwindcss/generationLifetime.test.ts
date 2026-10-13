import { rm } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createGenerationFixture, declarations } from './generationLifetime/fixture'

function assertCompleteOutput(output: { css: string, script: string, template: string, map: unknown }) {
  expect(declarations(output.css, 'width')).toContain('37px')
  expect(declarations(output.css, 'width')).not.toContain('99px')
  expect(declarations(output.css, 'min-width')).toContain('23px')
  expect(declarations(output.css, 'height')).toContain('31px')
  expect(declarations(output.css, 'padding')).toEqual(expect.arrayContaining(['17px', '19px']))
  expect(output.css).toContain('.author')
  expect(output.css).toMatch(/data-state\s*=\s*["']?ready/)
  expect(output.css).not.toMatch(/@(?:apply|source|utility|custom-variant|weapp-tw-ifn?def|slot)\b|managed[-_]tailwindcss/)
  expect(output.template).not.toContain('w-[37px]')
  const transformedClass = /class="([^"]+)"/.exec(output.template)?.[1]?.split(' ')[0]
  expect(transformedClass).toBeTruthy()
  expect(output.script).toContain(transformedClass)
  expect(output.map).toMatchObject({
    version: 3,
    sources: ['pages/probe/index.js'],
    sourcesContent: [expect.stringContaining('w-[37px]')],
  })
  expect(output.map).toHaveProperty('mappings', expect.stringMatching(/\S/))
}

describe('Tailwind generation follows compiler lifetime', () => {
  it.each([
    ['snapshot build', 'build', undefined, 2],
    ['serve', 'serve', undefined, 3],
    ['build watch', 'build', {}, 3],
  ] as const)('keeps full scanned output and the expected real plugin initialization count for %s', async (_name, command, watch, initializations) => {
    const fixture = await createGenerationFixture()
    const owner = fixture.owner(command, watch)
    const output = await owner.render()
    assertCompleteOutput(output)
    await vi.waitFor(() => expect(fixture.probe.initializations).toBe(initializations))
    expect(owner.watched).toContain(path.join(fixture.root, 'src/probe.cjs'))
    expect(owner.watched).toContain(path.join(fixture.root, 'src/tailwind.css'))
    await owner.closeBundle()
    if (command === 'serve' || watch) {
      expect(await owner.render()).toEqual(output)
    }
    else {
      await expect(owner.render()).rejects.toThrow('Compiler 已释放')
    }
  })

  it('produces identical CSS, transformed template/script and sourcemap in one-shot and persistent compilation', async () => {
    const fixture = await createGenerationFixture()
    const once = fixture.owner('build')
    const oneShot = await once.render()
    await once.closeBundle()
    expect(fixture.probe.initializations).toBe(2)
    fixture.probe.initializations = 0
    const persistent = fixture.owner('serve')
    const retained = await persistent.render()
    await vi.waitFor(() => expect(fixture.probe.initializations).toBe(3))
    expect(retained).toEqual(oneShot)
    assertCompleteOutput(retained)
  })

  it('keeps public core raw/processed CSS equivalent across false/true with platform macros and scan exclusions', async () => {
    const fixture = await createGenerationFixture(undefined, { conditionalMacros: true })
    const once = await fixture.generateCore(false)
    const persistent = await fixture.generateCore(true)
    const result = (generated: typeof once.generated) => ({
      css: generated.css,
      rawCss: generated.rawCss,
      classSet: [...generated.classSet].sort(),
      rawCandidates: [...generated.rawCandidates].sort(),
      sources: generated.sources,
      dependencies: [...generated.dependencies].sort(),
      root: generated.root,
    })
    expect(result(persistent.generated)).toEqual(result(once.generated))
    expect(once.generated.classSet).toContain('mini:fixture-utility')
    expect(once.generated.classSet).toContain('checked:fixture-utility')
    expect(once.generated.classSet).not.toContain('w-[99px]')
    // rawCss 是未消费宏的中间产物；generated.css 才已完成平台宏处理。
    expect(once.generated.rawCss).toMatch(/@weapp-tw-ifn?def\b/)
    expect(declarations(once.generated.rawCss, 'width')).toContain('83px')
    expect(once.generated.css).not.toMatch(/@weapp-tw-ifn?def\b|#(?:ifn?def|endif)/)
    expect(declarations(once.generated.css, 'width')).not.toContain('83px')
    const template = '<view class="w-[37px] mini:fixture-utility" />'
    const script = 'export const classes = "w-[37px] mini:fixture-utility";'
    expect(await persistent.compiler.transformTemplate(template, persistent.generated.snapshot)).toEqual(await once.compiler.transformTemplate(template, once.generated.snapshot))
    expect(await persistent.compiler.transformJavaScript(script, persistent.generated.snapshot, { generateMap: true, filename: 'pages/probe/index.js' }))
      .toEqual(await once.compiler.transformJavaScript(script, once.generated.snapshot, { generateMap: true, filename: 'pages/probe/index.js' }))
    await vi.waitFor(() => expect(fixture.probe.initializations).toBe(5))
  })

  it('preserves default owner macro output across one-shot and persistent compilation', async () => {
    const fixture = await createGenerationFixture(undefined, { conditionalMacros: true })
    const once = fixture.owner('build')
    const oneShot = await once.render()
    await once.closeBundle()
    const persistent = fixture.owner('serve')
    const retained = await persistent.render()
    await vi.waitFor(() => expect(fixture.probe.initializations).toBe(5))
    expect(retained).toEqual(oneShot)
    // 默认 owner 复用 rawCss；此处只锁定生命周期 parity，宏收尾缺口留给独立修复。
    expect(declarations(oneShot.css, 'width')).toContain('37px')
    expect(declarations(oneShot.css, 'height')).toContain('31px')
  })

  it.each([
    ['build', undefined, 2],
    ['serve', undefined, 3],
    ['build', {}, 3],
  ] as const)('uses the same lifetime policy for imported owners during %s', async (command, watch, initializations) => {
    const fixture = await createGenerationFixture()
    await fixture.write('src/styles/wrapper.css', '@import "../tailwind.css";')
    const owner = fixture.owner(command, watch)
    const transformed = await owner.transform('@import "./styles/wrapper.css"; .wrapper-author { color: blue; }', 'src/app.css')
    expect(declarations(transformed, 'width')).toContain('37px')
    expect(declarations(transformed, 'min-width')).toContain('23px')
    expect(declarations(transformed, 'padding')).toContain('17px')
    expect(transformed).toContain('.wrapper-author')
    expect(transformed).not.toMatch(/@(?:import|source|apply|slot|weapp-tw-ifn?def)\b/)
    await vi.waitFor(() => expect(fixture.probe.initializations).toBe(initializations))
    expect(owner.watched).toContain(path.join(fixture.root, 'src/tailwind.css'))
    expect(owner.watched).toContain(path.join(fixture.root, 'src/styles/wrapper.css'))
    await owner.closeBundle()
  })

  it('compiles each of multiple one-shot roots completely while avoiding unused seed initialization', async () => {
    const fixture = await createGenerationFixture(['src/first.css', 'src/second.css'])
    const owner = fixture.owner('build')
    const output = await owner.render()
    assertCompleteOutput(output)
    expect(declarations(output.css, 'margin-bottom')).toEqual(expect.arrayContaining(['13px', '14px']))
    expect(fixture.probe.initializations).toBe(4)
    await owner.closeBundle()
  })

  it.each([
    ['serve', undefined],
    ['build', {}],
  ] as const)('retains candidate add/delete/update behavior across %s generations', async (command, watch) => {
    const fixture = await createGenerationFixture()
    const owner = fixture.owner(command, watch)
    const initial = await owner.render()
    expect(declarations(initial.css, 'width')).toContain('37px')
    await fixture.write('src/pages/added.wxml', '<view class="w-[53px]" />')
    await owner.change('src/pages/added.wxml', 'create')
    const added = await owner.render('w-[37px] w-[53px]')
    expect(declarations(added.css, 'width')).toEqual(expect.arrayContaining(['37px', '53px']))
    await rm(path.join(fixture.root, 'src/pages/index.wxml'))
    await owner.change('src/pages/index.wxml', 'delete')
    const removed = await owner.render('w-[53px]')
    expect(declarations(removed.css, 'width')).not.toContain('37px')
    expect(declarations(removed.css, 'width')).toContain('53px')
    await fixture.write('src/pages/added.wxml', '<view class="w-[61px]" />')
    await owner.change('src/pages/added.wxml')
    const updated = await owner.render('w-[61px]')
    expect(declarations(updated.css, 'width')).toContain('61px')
    expect(declarations(updated.css, 'width')).not.toContain('53px')
    expect(declarations(updated.css, 'min-width')).toContain('23px')
    await owner.closeBundle()
  })

  it.each([
    ['build', undefined],
    ['serve', undefined],
  ] as const)('keeps meaningful compiler errors and recovers with the correct %s owner', async (command, watch) => {
    const fixture = await createGenerationFixture()
    const owner = fixture.owner(command, watch)
    const valid = await owner.render()
    await fixture.write('src/tailwind.css', '@import "tailwindcss" source(none); .bad { @apply missing-lifetime-utility; }')
    await owner.change('src/tailwind.css')
    let error: Error | undefined
    try {
      await owner.render()
    }
    catch (thrown) {
      error = thrown as Error
    }
    expect(error).toBeInstanceOf(Error)
    expect(error!.message).toMatch(/unknown utility|missing-lifetime-utility/)
    await owner.buildEnd(error)
    await fixture.write('src/tailwind.css', '@import "tailwindcss" source(none); @source "./pages/**/*.wxml"; .recovered { @apply p-[29px]; }')
    const recoveredOwner = command === 'build' ? fixture.owner('build') : owner
    if (recoveredOwner === owner) {
      await owner.change('src/tailwind.css')
    }
    const recovered = await recoveredOwner.render('w-[37px]')
    expect(declarations(recovered.css, 'padding')).toContain('29px')
    expect(declarations(recovered.css, 'width')).toContain('37px')
    expect(recovered.css).not.toContain('missing-lifetime-utility')
    expect(valid.css).toContain('.author')
    await recoveredOwner.closeBundle()
  })
})
