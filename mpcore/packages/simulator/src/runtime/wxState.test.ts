import { describe, expect, it } from 'vitest'
import { createHeadlessWxState } from './wxState'

describe('strict headless wx mocks', () => {
  it('throws when side-effecting host APIs have no configured mock', () => {
    const state = createHeadlessWxState(undefined, { strictMocks: true })
    state.setFile('headless://temp/upload.txt', 'upload')

    expect(() => state.request({ url: 'https://unmatched.mpcore.dev' })).toThrow('No request mock matched')
    expect(() => state.downloadFile({ url: 'https://unmatched.mpcore.dev/file' })).toThrow('No downloadFile mock matched')
    expect(() => state.uploadFile({
      filePath: 'headless://temp/upload.txt',
      name: 'file',
      url: 'https://unmatched.mpcore.dev/upload',
    })).toThrow('No uploadFile mock matched')
    expect(() => state.showModal({ content: 'confirm' })).toThrow('No modal mock matched')
    expect(() => state.showActionSheet({ itemList: ['first'] })).toThrow('No actionSheet mock matched')
  })

  it('keeps the simulator compatibility defaults when strict mocks are disabled', () => {
    const state = createHeadlessWxState()

    expect(state.showModal({ content: 'confirm' })).toMatchObject({ confirm: true })
    expect(state.showActionSheet({ itemList: ['first'] })).toMatchObject({ tapIndex: 0 })
    expect(() => state.request({ url: 'https://unmatched.mpcore.dev' })).not.toThrow()
  })
})
