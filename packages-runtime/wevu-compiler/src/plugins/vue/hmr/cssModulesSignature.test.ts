import { expect, it } from 'vitest'
import { classifyVueSfcBlockChanges, resolveVueSfcHmrSignatures } from './sfcSignature'

const filename = '/project/src/pages/index.vue'
const signatures = (source: string) => resolveVueSfcHmrSignatures(source, filename)

it.each(['module', 'module="theme"'])('classifies %s style changes as script and style updates', (attribute) => {
  const source = `<template><view :class="$style.panel" /></template><style ${attribute}>.panel { color: red; }</style>`
  const before = signatures(source)
  for (const updated of [source.replace('red', 'blue'), source.replace('.panel {', '.card {'), source.replace(attribute, 'module="other"'), source.replace(attribute, ''), source.replace(/<style.*<\/style>/, '')]) {
    const after = signatures(updated)
    expect(classifyVueSfcBlockChanges(before.blockSignatures!, after.blockSignatures!)).toEqual(['script', 'style'])
    expect(classifyVueSfcBlockChanges(after.blockSignatures!, before.blockSignatures!)).toEqual(['script', 'style'])
    expect(after.styleIndependentSignature).not.toBe(before.styleIndependentSignature)
  }
})

it('keeps ordinary style changes asset-only beside an unchanged CSS Module', () => {
  const source = '<template><view /></template><style module>.panel { color: red; }</style><style>.ordinary { color: black; }</style>'
  const before = signatures(source)
  const after = signatures(source.replace('black', 'white'))
  expect(classifyVueSfcBlockChanges(before.blockSignatures!, after.blockSignatures!)).toEqual(['style'])
  expect(after.styleIndependentSignature).toBe(before.styleIndependentSignature)
})

it('invalidates the script mapping when an external CSS Module source changes', () => {
  const before = signatures('<template><view /></template><style module src="./one.css" />')
  const after = signatures('<template><view /></template><style module src="./two.css" />')
  expect(classifyVueSfcBlockChanges(before.blockSignatures!, after.blockSignatures!)).toEqual(['script', 'style'])
})
