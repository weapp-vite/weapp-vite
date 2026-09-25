import { afterEach, describe, expect, it, vi } from 'vitest'
import * as scanner from '../template/scan'
import { createValidationNodes } from '../validate/walk'
import { editWxml } from './editor'
import * as encoding from './encoding'
import * as editing from './node'

// 统计实际初始化次数，不对受机器负载影响的毫秒数作断言。
describe('lazy WXML observations and editors', () => {
  afterEach(() => vi.restoreAllMocks())

  it.each(['skip', 'remove'])('only creates the visited root editor when descendants %s', async (operation) => {
    const create = vi.spyOn(editing, 'createEditableNode')
    const locate = vi.spyOn(encoding, 'createLocator')
    const scan = vi.spyOn(scanner, 'scanTemplate')
    const source = `<view>${'<text title="中文"/>'.repeat(10000)}</view>`
    const output = await editWxml(source, 'page.wxml', 'legacy', (node) => {
      if (operation === 'skip') {
        node.skipChildren()
      }
      else {
        node.remove()
      }
    })
    expect(output).toBe(operation === 'skip' ? source : '')
    expect(create).toHaveBeenCalledTimes(1)
    expect(locate).not.toHaveBeenCalled()
    expect(scan).toHaveBeenCalledTimes(1)
  })

  it('lazily materializes attributes and positions for editing and validation', async () => {
    const scan = scanner.scanTemplate
    const rawRead = vi.fn()
    vi.spyOn(scanner, 'scanTemplate').mockImplementation((...args) => {
      const result = scan(...args)
      for (const element of result.elements) {
        for (const attr of element.attrs) {
          const start = attr.valueStart
          Object.defineProperty(attr, 'valueStart', { get() {
            rawRead()
            return start
          } })
        }
      }
      return result
    })
    const locate = vi.spyOn(encoding, 'createLocator')
    const source = '<view title="中文"><text value="{{value}}"/></view>'
    expect(await editWxml(source, 'page.wxml', 'legacy', () => {})).toBe(source)
    const nodes = createValidationNodes(source, 'page.wxml', 'legacy')
    expect(rawRead).not.toHaveBeenCalled()
    expect(locate).not.toHaveBeenCalled()
    expect(nodes[0]!.children[0]).toBe(nodes[1])
    expect(nodes[1]!.getAttribute('value')?.rawValue).toBe('{{value}}')
    expect(rawRead).toHaveBeenCalledTimes(1)
    expect(nodes[1]!.attributes).toBe(nodes[1]!.attributes)
    expect(nodes[1]!.location).toBe(nodes[1]!.location)
    expect(locate).toHaveBeenCalledTimes(1)
  })
})
