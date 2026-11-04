import type { FrameworkTarget, GenerationEvidence } from './types'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { listOutputFiles, outputFileIdentity, writeProjectFile } from './files'
import { collectGeneratedDocuments } from './output'

const directories: string[] = []
const target: FrameworkTarget = {
  target: 'quickapp',
  platform: 'quickapp',
  profileId: 'quickapp-container',
  extensions: ['.ux'],
  container: 'template',
  support: 'candidate',
  evidence: 'official QuickApp container output',
}

async function project(files: Record<string, string>) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'template-container-output-'))
  directories.push(directory)
  for (const [file, source] of Object.entries(files)) {
    await writeProjectFile(directory, `out/development/${file}`, source)
  }
  const outputs = await Promise.all((await listOutputFiles(directory, 'development')).map(file => outputFileIdentity(directory, file, 'development')))
  const report: GenerationEvidence = {
    schemaVersion: 1,
    id: 'taro-quickapp-development',
    framework: 'taro',
    version: '2.2.22',
    target: 'quickapp',
    mode: 'development',
    source: { repository: 'owner/project', commit: 'a'.repeat(40), licenseId: 'confirmed' },
    inputDependencies: {},
    runtime: { node: 'v22.0.0', packageManager: 'pnpm@10.0.0' },
    input: [],
    configuration: [],
    dependencies: [],
    outputs,
    logs: [],
    commands: [],
    status: 'built',
  }
  return { directory, report }
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe('generated template container eligibility', () => {
  it('retains app.ux evidence while collecting an explicit empty page template', async () => {
    const { directory, report } = await project({
      'app.ux': '<script>export default { onCreate() {} }</script>',
      'pages/home.ux': '<template></template><script>export default {}</script>',
    })
    const outputs = [...report.outputs]
    const documents = await collectGeneratedDocuments(directory, 'out/development', target, report)
    expect(documents.map(document => document.source)).toEqual([''])
    expect(documents[0]!.origins[0]!.path).toBe('out/development/pages/home.ux')
    expect(report.outputs).toEqual(outputs)
    expect(report.nonTemplateOutputs).toEqual([{ original: outputs[0], reason: 'no-explicit-template' }])
    expect(await collectGeneratedDocuments(directory, 'out/development', target, report)).toEqual(documents)
    report.nonTemplateOutputs![0]!.original = { ...outputs[0]!, sha256: 'b'.repeat(64) }
    await expect(collectGeneratedDocuments(directory, 'out/development', target, report)).rejects.toThrow('Frozen non-template output exclusions changed')
  })

  it('keeps a no-template-only cell incomplete with an explicit exclusion identity', async () => {
    const { directory, report } = await project({ 'app.ux': '<script>export default {}</script>' })
    await expect(collectGeneratedDocuments(directory, 'out/development', target, report)).rejects.toThrow('Compiler emitted no registered markup templates')
    expect(report.nonTemplateOutputs).toEqual([{ original: report.outputs[0], reason: 'no-explicit-template' }])
  })

  it('rejects malformed UX instead of classifying parser failures as non-templates', async () => {
    for (const source of ['<template', '<template><div/>', '<template></template><template></template>', '<script>export default {}']) {
      const { directory, report } = await project({ 'app.ux': source, 'page.ux': '<template><div/></template>' })
      await expect(collectGeneratedDocuments(directory, 'out/development', target, report)).rejects.toThrow()
      expect(report.nonTemplateOutputs).toBeUndefined()
    }
  })
})
