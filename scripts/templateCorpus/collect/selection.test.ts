import type { CorpusSource } from '../types'
import type { GitTreeEntry } from './github'
import { expect, it } from 'vitest'
import { extractContainerTemplate, matchesSelection, suspiciousExtension, validateSource } from './selection'

const selection = { platform: 'weapp', profileId: 'weapp-legacy', extensions: ['.wxml'], evidence: ['app.json'] }
const files: GitTreeEntry[] = ['LICENSE', 'app.json', 'pages/home.wxml'].map(path => ({ path, type: 'blob', sha: 'a'.repeat(40) }))
const source: CorpusSource = { repository: 'example/templates', commit: 'b'.repeat(40), license: { spdx: 'MIT', files: ['LICENSE'] }, selections: [selection] }

it('selects explicit glob ranges without inferring a platform from its extension', () => {
  expect(matchesSelection('pages/home.wxml', selection)).toBe(true)
  expect(matchesSelection('pages/home.axml', selection)).toBe(false)
  expect(matchesSelection('test/invalid.wxml', { ...selection, exclude: ['test/**'] })).toBe(false)
  expect(matchesSelection('.hidden/template.wxml', { ...selection, include: ['**/*.wxml'] })).toBe(true)
})

it('requires frozen commits, confirmed licenses and actual project evidence paths', () => {
  expect(() => validateSource(source, files)).not.toThrow()
  expect(() => validateSource({ ...source, commit: 'main' }, files)).toThrow('complete commit SHA')
  expect(() => validateSource({ ...source, license: { spdx: 'NOASSERTION', files: ['LICENSE'] } }, files)).toThrow('unconfirmed')
  expect(() => validateSource({ ...source, selections: [{ ...selection, evidence: ['missing.json'] }] }, files)).toThrow('evidence is missing')
})

it('rejects unrelated same-extension configuration and requires mini-program sidecars', () => {
  expect(suspiciousExtension('config.tyml', 'name: build', files)).toBe('ambiguous-extension-without-template-markup')
  expect(suspiciousExtension('page.ksml', '<window/>', files)).toBe('ambiguous-extension-without-mini-program-sidecar')
  expect(suspiciousExtension('page.tyml', '<view/>', [...files, { path: 'page.json', type: 'blob', sha: 'c'.repeat(40) }])).toBeUndefined()
  expect(suspiciousExtension('page.wxml', 'plain text', files)).toBeUndefined()
  expect(suspiciousExtension('page.tyml', '<!-- empty template -->', [...files, { path: 'page.js', type: 'blob', sha: 'd'.repeat(40) }], true)).toBeUndefined()
  expect(suspiciousExtension('config.tyml', 'name: build', [...files, { path: 'config.json', type: 'blob', sha: 'd'.repeat(40) }], true)).toBe('ambiguous-extension-without-template-markup')
})

it('extracts only the explicit UX template region with exact UTF-16 offsets', () => {
  const template = '<div title=">">😀{{ "</template>" }}<!-- </template> --><![CDATA[<template>]]><template name="nested"><text/></template><template is="row"/></div>'
  const input = `<!-- <template>fake</template> --><script>const text = "</script><template>"; /* </script> */\n</script>\r\n<template>\r\n${template}\r\n</template><style>.x::before { content: "</style><template>"; }</style>`
  const extracted = extractContainerTemplate(input)
  expect(extracted.source).toBe(`\r\n${template}\r\n`)
  expect(input.slice(extracted.start, extracted.end)).toBe(extracted.source)
  expect(extracted.start).toBe(input.indexOf('\r\n', input.indexOf('<template>\r\n')))
})

it('rejects ambiguous or incomplete container boundaries instead of collecting a guessed region', () => {
  expect(() => extractContainerTemplate('<script>"<template>"</script>')).toThrow('no explicit template')
  expect(() => extractContainerTemplate('<template/>')).toThrow('no explicit region')
  expect(() => extractContainerTemplate('<template><view/>')).toThrow('Unterminated container template')
  expect(() => extractContainerTemplate('<template>a</template><template>b</template>')).toThrow('multiple top-level')
  expect(() => extractContainerTemplate('<template><!-- bad</template>')).toThrow('Unterminated container')
})

it('keeps script-like tags inside regular expressions and nested template strings outside the template tree', () => {
  const raw = `<script>const pattern = /[</script>]/; const text = \`outer \${\`inner \${"</script><template>"}\`}\`;</script>`
  const template = `<div>{{ /}}<template>/.test(value) }}{{ \`outer \${\`inner \${"</template>"}\`}\` }}</div>`
  const input = `${raw}<template>${template}</template><style>.x { background: url(https://example.invalid/image.png) }</style>`
  expect(extractContainerTemplate(input).source).toBe(template)
})
