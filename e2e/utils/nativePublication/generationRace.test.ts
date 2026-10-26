import { access, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, it, onTestFailed } from 'vitest'
import { captureNativePublication } from '.'
import { createDevBuildCompletion } from '../devBuildCompletion'
import { NATIVE_PUBLICATION_PREFIX, nativePublicationHash } from './files'
import { createGenerationFixture } from './generationFixture'

it.each(['before', 'after'] as const)('observes native retirement with an unchanged retained template when the observer is %s the publisher', async (order) => {
  const fixture = await createGenerationFixture(order)
  onTestFailed(() => fixture.diagnostics())
  try {
    const publication = captureNativePublication(fixture.dev, fixture.project)
    await fixture.render({ betweenPlugins: [{
      name: 'fixture:optional-output',
      generateBundle() { this.emitFile({ type: 'asset', fileName: 'optional.wxss', source: '.optional { color: red; }' }) },
    }] })
    expect(await readFile(path.join(fixture.project, 'dist/optional.wxss'), 'utf8')).toContain('.optional')
    fixture.rebuild()
    await fixture.render({ betweenPlugins: [{
      name: 'fixture:final-output',
      generateBundle() { this.emitFile({ type: 'asset', fileName: 'final.txt', source: 'restored' }) },
    }] })
    expect(fixture.nativeWrites[1]).toContain('final.txt')
    expect(fixture.nativeWrites[1]).not.toContain('pages/index/index.wxml')
    expect(fixture.nativeWrites[1]).not.toContain('optional.wxss')
    expect(await access(path.join(fixture.project, 'dist/optional.wxss')).then(() => true, () => false)).toBe(false)
    const receipt = await publication.wait(500)
    expect(receipt).toMatchObject({ boundary: 'native-byte-write', outputScope: 'committed', publicationEpoch: expect.any(Number) })
    expect(Object.keys(receipt.outputs).sort()).toEqual(['app.js', 'final.txt', 'pages/index/index.wxml'])
    expect(receipt.outputs['app.js']).toBe(nativePublicationHash(await readFile(path.join(fixture.project, 'dist/app.js'))))
  }
  finally {
    await fixture.close()
  }
})

it.each(['before', 'after'] as const)('observes a final source generation with a fully pruned follow-up build when the observer is %s the publisher', async (order) => {
  const fixture = await createGenerationFixture(order)
  onTestFailed(() => fixture.diagnostics())
  try {
    await fixture.render()
    expect(fixture.dev.getOutput()).toContain(NATIVE_PUBLICATION_PREFIX)
    fixture.clearOutput()
    fixture.rebuild()
    const publication = captureNativePublication(fixture.dev, fixture.project)
    fixture.saveDuringBuild()
    await fixture.render()
    expect(fixture.nativeWrites[1]).toEqual(['app.js', 'pages/index/index.wxml'])
    expect(await readFile(fixture.outputTemplate, 'utf8')).toBe('<view>FINAL</view>')
    expect(fixture.dev.getOutput()).toBe('')
    const finalApp = nativePublicationHash(await readFile(path.join(fixture.project, 'dist/app.js')))
    // 后续构建求值最终源码；真实发布插件裁掉已持久化的相同字节，仍需新的完成证据。
    await fixture.render()
    expect(fixture.nativeWrites[2]).toEqual([])
    expect(await readFile(fixture.template, 'utf8')).toBe('<view>FINAL</view>')
    const receipt = await publication.wait(200)
    expect(receipt.boundary).toBe('native-noop')
    expect(receipt.publicationEpoch).toEqual(expect.any(Number))
    expect(receipt.inputs['src/pages/index/index.wxml']).toBe(nativePublicationHash('<view>FINAL</view>'))
    expect(receipt.outputs).toEqual({ 'app.js': finalApp, 'pages/index/index.wxml': nativePublicationHash('<view>FINAL</view>') })
  }
  finally {
    await fixture.close()
  }
})

it('does not acknowledge a pruned build when a different native build replaced committed disk bytes', async () => {
  const fixture = await createGenerationFixture('before')
  try {
    await fixture.render()
    fixture.clearOutput()
    fixture.rebuild()
    await fixture.render({ foreign: true })
    const publication = captureNativePublication(fixture.dev, fixture.project)
    await fixture.render()
    expect(fixture.nativeWrites[1]).toEqual([])
    expect(fixture.dev.getOutput()).toBe('')
    await expect(publication.wait(100)).rejects.toThrow('final source generation')
  }
  finally {
    await fixture.close()
  }
})

it('releases an earlier observer request when another write hook fails before publication', async () => {
  const fixture = await createGenerationFixture('before')
  try {
    await fixture.render()
    fixture.clearOutput()
    fixture.rebuild()
    await expect(fixture.render({ betweenPlugins: [{
      name: 'fixture:failed-before-publication',
      enforce: 'post',
      writeBundle: { order: 'post', sequential: true, handler() { throw new Error('before publication rejected') } },
    }] })).rejects.toThrow('before publication rejected')
    expect(fixture.dev.getOutput()).toBe('')
    // 取消只结束观察者自己的等待，后续正常发布仍可认领同字节的新代次。
    const recovered = captureNativePublication(fixture.dev, fixture.project)
    await fixture.render()
    expect((await recovered.wait(200)).boundary).toBe('native-noop')
  }
  finally {
    await fixture.close()
  }
})

it('does not acknowledge no-op bytes when source changes in the native write phase', async () => {
  const fixture = await createGenerationFixture('after')
  try {
    await fixture.render()
    fixture.clearOutput()
    fixture.rebuild()
    await fixture.render({ betweenPlugins: [{
      name: 'fixture:save-after-native-commit',
      enforce: 'post',
      writeBundle: {
        order: 'post',
        sequential: true,
        async handler() { await writeFile(fixture.template, '<view>NEXT</view>') },
      },
    }] })
    expect(fixture.nativeWrites[1]).toEqual([])
    expect(await readFile(fixture.outputTemplate, 'utf8')).toBe('<view>BASE</view>')
    expect(fixture.dev.getOutput()).toBe('')
  }
  finally {
    await fixture.close()
  }
})

it.each(['before', 'after'] as const)('retains a later native failure after a no-op candidate with the observer %s the publisher', async (order) => {
  const fixture = await createGenerationFixture(order)
  try {
    await fixture.render()
    fixture.clearOutput()
    fixture.rebuild()
    const completion = createDevBuildCompletion(fixture.dev, { source: { file: fixture.template, profilePath: fixture.profilePath } })
    const earlier = `${JSON.stringify({
      schemaVersion: 1,
      pipeline: 'standard',
      sessionId: 'native-session',
      buildId: 'earlier-build',
      batchId: 'earlier-batch',
      totalMs: 1,
      status: 'complete',
      correlation: 'known',
      clock: { durations: 'performance.now', timestamp: 'UTC', timeOrigin: performance.timeOrigin },
      sourceEvents: [{ eventId: 'earlier-event', event: 'update', file: fixture.template, receivedAtMs: performance.now() }],
    })}\n`
    await writeFile(fixture.profilePath, earlier)
    const publication = captureNativePublication(fixture.dev, fixture.project)
    await expect(fixture.render({ afterPlugins: [{
      name: 'fixture:late-native-failure',
      enforce: 'post',
      writeBundle: { order: 'post', sequential: true, handler() { throw new Error('late native commit rejected') } },
    }] })).rejects.toThrow('late native commit rejected')
    const receipt = await publication.wait(200)
    expect(receipt.boundary).toBe('native-noop')
    expect(receipt.profileCursor).toEqual({ offset: earlier.length, prefixHash: nativePublicationHash(earlier) })
    await expect(completion.wait(100, receipt.profileCursor)).rejects.toThrow('Timed out waiting for current dev build')
  }
  finally {
    await fixture.close()
  }
})
