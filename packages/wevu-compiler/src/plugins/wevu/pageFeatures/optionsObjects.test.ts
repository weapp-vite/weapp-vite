import { describe, expect, it, vi } from 'vitest'
import { parseJsLike } from '../../../utils/babel'
import * as babelUtils from '../../../utils/babel'
import { collectTargetOptionsObjects, collectTargetOptionsObjectsFromCode, getSetupFunctionFromOptionsObject } from './optionsObjects'

describe('optionsObjects analysis', () => {
  it('collects options objects from wevu component factory calls', () => {
    const source = `
import { defineComponent, createWevuComponent } from 'wevu'
import * as wevu from 'wevu'

const optionsRef = {
  setup() {},
  data: 1,
}
const optionsLater = {
  setup: () => {},
}

defineComponent({ setup() {}, inline: true })
createWevuComponent(optionsRef)
wevu.defineComponent?.(optionsLater)
defineComponent(Object.assign({}, optionsRef, { setup() {} }))
    `.trim()

    const { optionsObjects } = collectTargetOptionsObjects(parseJsLike(source), '/project/src/page.ts')
    expect(optionsObjects.length).toBeGreaterThanOrEqual(4)

    const setupCount = optionsObjects
      .map(optionsObject => getSetupFunctionFromOptionsObject(optionsObject))
      .filter(Boolean)
      .length
    expect(setupCount).toBeGreaterThanOrEqual(4)
  })

  it('supports object method and function-expression setup properties', () => {
    const withMethod = parseJsLike(`
import { defineComponent } from 'wevu'
defineComponent({
  setup() {},
})
    `.trim())
    const withFunctionExpression = parseJsLike(`
import { defineComponent } from 'wevu'
defineComponent({
  setup: function () {},
})
    `.trim())

    const methodOptions = collectTargetOptionsObjects(withMethod, '/project/src/a.ts').optionsObjects[0]
    const functionOptions = collectTargetOptionsObjects(withFunctionExpression, '/project/src/b.ts').optionsObjects[0]

    expect(getSetupFunctionFromOptionsObject(methodOptions)).toBeTruthy()
    expect(getSetupFunctionFromOptionsObject(functionOptions)).toBeTruthy()
  })

  it('collects options objects from source with ast engine option', () => {
    const source = `
import { defineComponent } from 'wevu'
const optionsRef = {
  setup() {},
}
defineComponent(optionsRef)
    `.trim()

    const { optionsObjects } = collectTargetOptionsObjectsFromCode(source, '/project/src/page.ts', {
      astEngine: 'oxc',
    })

    expect(optionsObjects).toHaveLength(1)
    expect(getSetupFunctionFromOptionsObject(optionsObjects[0])).toBeTruthy()
  })

  it('fast rejects unrelated files with oxc engine before babel parsing', () => {
    const parseSpy = vi.spyOn(babelUtils, 'parseJsLike')
    const source = `
import { ref } from 'vue'

export function setupStore() {
  return ref(1)
}
    `.trim()

    const result = collectTargetOptionsObjectsFromCode(source, '/project/src/store.ts', {
      astEngine: 'oxc',
    })

    expect(result.optionsObjects).toEqual([])
    expect(result.module.engine).toBe('oxc')
    expect(result.module.importedBindings.size).toBe(0)
    expect(parseSpy).not.toHaveBeenCalled()

    parseSpy.mockRestore()
  })

  it('fast rejects files that import wevu factories but never call them', () => {
    const parseSpy = vi.spyOn(babelUtils, 'parseJsLike')
    const source = `
import { defineComponent } from 'wevu'
import * as wevu from 'wevu'

const local = defineComponent
const namespaceFactory = wevu.defineComponent

export function setupStore() {
  return [local, namespaceFactory]
}
    `.trim()

    const result = collectTargetOptionsObjectsFromCode(source, '/project/src/store.ts', {
      astEngine: 'oxc',
    })

    expect(result.optionsObjects).toEqual([])
    expect(result.module.engine).toBe('oxc')
    expect(result.module.importedBindings.size).toBe(2)
    expect(parseSpy).not.toHaveBeenCalled()

    parseSpy.mockRestore()
  })

  it('keeps babel fallback when wevu factory call is textually present', () => {
    const parseSpy = vi.spyOn(babelUtils, 'parseJsLike')
    const source = `
import * as wevu from 'wevu'

wevu.defineComponent({
  setup() {},
})
    `.trim()

    const result = collectTargetOptionsObjectsFromCode(source, '/project/src/page.ts', {
      astEngine: 'oxc',
    })

    expect(result.optionsObjects).toHaveLength(1)
    expect(getSetupFunctionFromOptionsObject(result.optionsObjects[0])).toBeTruthy()
    expect(parseSpy).toHaveBeenCalledTimes(1)

    parseSpy.mockRestore()
  })
})
