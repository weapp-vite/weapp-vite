import { WEAPP_I18N_RUNTIME_MARKER } from '@weapp-core/constants'
import { expect, it } from 'vitest'
import { serializeStaticValueToExpression } from './serialize'

it('prefers the directly imported marker over a nested alias', () => {
  const behavior = { [WEAPP_I18N_RUNTIME_MARKER]: true }
  expect(serializeStaticValueToExpression({ behaviors: [behavior] }, undefined, {
    i18n: { behavior },
    behavior,
  })).toBe('{ behaviors: [behavior] }')
})

it('resolves bracket members without following cyclic container references forever', () => {
  const behavior = { [WEAPP_I18N_RUNTIME_MARKER]: true }
  const localization: Record<string, unknown> = {}
  localization.self = localization
  localization['active-locale'] = { behavior }
  expect(serializeStaticValueToExpression({ behaviors: [behavior] }, undefined, { localization }))
    .toBe('{ behaviors: [localization["active-locale"].behavior] }')
})
