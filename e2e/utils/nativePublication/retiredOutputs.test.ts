import { access, writeFile } from 'node:fs/promises'
import { expect, it } from 'vitest'
import { captureNativePublication } from '.'
import { nativePublicationHash } from './files'
import { createGenerationFixture } from './generationFixture'

it.each(['before', 'after'] as const)('retires earlier output evidence after the same source generation commits its complete ownership with the observer %s the publisher', async (order) => {
  const fixture = await createGenerationFixture(order)
  try {
    await fixture.render()
    fixture.clearOutput()
    fixture.rebuild()
    await writeFile(fixture.template, '<view>FINAL</view>')
    const publication = captureNativePublication(fixture.dev, fixture.project)
    await fixture.render()
    fixture.retireTemplateOutput()
    await fixture.render()
    await expect(access(fixture.outputTemplate)).rejects.toMatchObject({ code: 'ENOENT' })
    const receipt = await publication.wait(200)
    expect(receipt.outputScope).toBe('committed')
    expect(receipt.publicationEpoch).toEqual(expect.any(Number))
    expect(receipt.inputs['src/pages/index/index.wxml']).toBe(nativePublicationHash('<view>FINAL</view>'))
    expect(receipt.outputs).not.toHaveProperty('pages/index/index.wxml')
  }
  finally {
    await fixture.close()
  }
})
