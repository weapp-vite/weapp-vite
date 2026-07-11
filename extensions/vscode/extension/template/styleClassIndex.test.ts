import assert from 'node:assert/strict'
import { it } from 'vitest'

import {
  collectStyleClassMatches,
} from './styleClassIndex'

function getClassNames(sourceText: string, filePath: string) {
  return collectStyleClassMatches(sourceText, filePath).map(match => match.className)
}

it('indexes CSS, SCSS and Less nested selectors without treating declarations as classes', () => {
  const sourceText = [
    '.card, .panel {',
    '  color: red;',
    '  .title, > .summary { color: blue; }',
    '  &__body {',
    '    &--active:hover { color: green; }',
    '  }',
    '  &:not(.disabled) { background: url(icon.demo.png); }',
    '}',
    '/* .commented { color: red; } */',
    '.rounded(@radius) { border-radius: @radius; }',
  ].join('\n')

  const classNames = getClassNames(sourceText, '/workspace/index.scss')

  assert.deepEqual(classNames, [
    'card',
    'panel',
    'title',
    'summary',
    'card__body',
    'panel__body',
    'card__body--active',
    'panel__body--active',
    'disabled',
  ])
  assert.equal(classNames.includes('demo'), false)
  assert.equal(classNames.includes('commented'), false)
})

it('indexes indented Sass and Stylus selectors with nested ampersands', () => {
  const sassSource = [
    '.meter',
    '  color: red',
    '  &__head',
    '    .label',
    '      font-weight: 600',
    '  &--active',
    '    color: green',
  ].join('\n')

  assert.deepEqual(getClassNames(sassSource, '/workspace/index.sass'), [
    'meter',
    'meter__head',
    'label',
    'meter--active',
  ])
  assert.deepEqual(getClassNames('.stylus-card\n  color #444', '/workspace/index.stylus'), ['stylus-card'])
})

it('keeps source offsets on generated ampersand class definitions', () => {
  const sourceText = '.meter {\n  &__value { color: red; }\n}'
  const match = collectStyleClassMatches(sourceText, '/workspace/index.less')
    .find(item => item.className === 'meter__value')

  assert.equal(match?.offset, sourceText.indexOf('&__value'))
})
