import { describe, expect, it } from 'vitest'
import { collectScriptSetupImportsFromCode } from '../../src/ast/operations/scriptSetupImports'

describe('collectScriptSetupImportsFromCode', () => {
  it('keeps babel and oxc results aligned', () => {
    const source = `
import type { FooProps } from './types'
import FooCard, { BarButton as RenamedButton, BazText } from './components'
import { IgnoredOnly } from './ignored'

const local = 1
`

    const templateComponentNames = new Set(['FooCard', 'RenamedButton', 'MissingTag'])

    expect(collectScriptSetupImportsFromCode(source, templateComponentNames, { astEngine: 'babel' })).toEqual(
      collectScriptSetupImportsFromCode(source, templateComponentNames, { astEngine: 'oxc' }),
    )
    expect(collectScriptSetupImportsFromCode(source, templateComponentNames, { astEngine: 'oxc' })).toEqual([
      {
        localName: 'FooCard',
        importSource: './components',
        importedName: 'default',
        kind: 'default',
      },
      {
        localName: 'RenamedButton',
        importSource: './components',
        importedName: 'BarButton',
        kind: 'named',
      },
    ])
  })
})
