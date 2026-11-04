import type { CorpusDocument } from '../types'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import { extractContainerTemplate } from '../collect/container'
import { corpusHash, corpusJson } from '../integrity'
import { freezeNativeEvidence } from './native'
import { nativeMetadata, sourceIdentity, sourceTree } from './testFixtures'
import { validateFrozenReferences } from './verify'

function nativeCase(container = false) {
  const original = container ? '\uFEFF<template><div>😀</div></template>\r\n<script>const fake = "<template>bad</template>"</script>' : '\uFEFF<view>😀</view>\r\n'
  const extracted = container ? extractContainerTemplate(original) : undefined
  const file = container ? 'src/index.ux' : 'pages/home.wxml'
  const tree = [...sourceTree, { path: file, type: 'blob' as const, sha: createHash('sha1').update(`blob ${Buffer.byteLength(original)}\0`).update(original).digest('hex') }]
  const { metadata } = nativeMetadata()
  const source = extracted?.source ?? original
  const document: CorpusDocument = { source, sha256: corpusHash(source), origins: [{ ...sourceIdentity, path: file, category: 'native', expectation: 'valid', platform: container ? 'quickapp' : 'weapp', profileId: container ? 'quickapp-template' : 'weapp-legacy', evidence: extracted ? [`container-sha256:${corpusHash(original)}`, `container-template-utf16:${extracted.start}:${extracted.end}`] : [] }] }
  const frozen = freezeNativeEvidence({
    repositories: [{ ...metadata.repositories[0]!, treeFiles: tree.length, treeSha256: corpusHash(corpusJson(tree)) }],
    sources: [{ ...sourceIdentity, tree, configuration: sourceIdentity, containers: container ? [{ path: file, text: original, sha256: corpusHash(original) }] : [] }],
    discovery: [],
  })
  metadata.repositories = frozen.repositories
  return { metadata, document, resources: frozen.resources }
}

it('ties regular native template bytes to the frozen Git blob, retaining BOM and CRLF', () => {
  const { metadata, document, resources } = nativeCase()
  expect(() => validateFrozenReferences(metadata, [document], resources)).not.toThrow()
  document.source = '<view>replaced</view>'
  document.sha256 = corpusHash(document.source)
  expect(() => validateFrozenReferences(metadata, [document], resources)).toThrow('Native template Git blob mismatch')
})

it('freezes the complete native UX source and verifies its original projection and UTF16 range', () => {
  const { metadata, document, resources } = nativeCase(true)
  expect(() => validateFrozenReferences(metadata, [document], resources)).not.toThrow()
  document.origins[0]!.evidence = ['container-template-utf16:0:0']
  expect(() => validateFrozenReferences(metadata, [document], resources)).toThrow('projection evidence changed')
})

it('refuses missing native container bodies and replacements that only preserve the extracted template', () => {
  const { metadata, document, resources } = nativeCase(true)
  const referenceResource = resources.find(resource => resource.file.startsWith('sources/'))!
  const reference = JSON.parse(new TextDecoder().decode(referenceResource.content as Uint8Array)) as { containers: Array<{ object: { file: string } }> }
  const container = resources.find(resource => resource.file === reference.containers[0]!.object.file)!
  expect(() => validateFrozenReferences(metadata, [document], resources.filter(resource => resource !== container))).toThrow('Missing frozen evidence resource')
  container.content = '<template><div>😀</div></template>'
  expect(() => validateFrozenReferences(metadata, [document], resources)).toThrow('reference size mismatch')
})

it('binds license attribution and platform identity text to actual source blobs independently of their own SHA256', () => {
  const { metadata, resources } = nativeCase()
  const license = metadata.licenses[0]!.files[0]!
  if ('text' in license) {
    license.text += '\nreplaced attribution'
    license.sha256 = corpusHash(license.text)
  }
  expect(() => validateFrozenReferences(metadata, [], resources)).toThrow('License attribution Git blob mismatch')
  const identity = nativeCase()
  identity.metadata.repositories[0]!.identityEvidence = [{ path: 'missing.json', text: '{}', sha256: corpusHash('{}') }]
  expect(() => validateFrozenReferences(identity.metadata, [], identity.resources)).toThrow('identity evidence has no regular frozen source blob')
})
