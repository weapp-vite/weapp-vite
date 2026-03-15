import { describe, expect, it } from 'vitest'
import { parseJsLike } from '../../../utils/babel'
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
})
