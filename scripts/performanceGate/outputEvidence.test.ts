import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { captureOutputEvidence } from './outputEvidence'

let root: string | undefined
afterEach(async () => {
  if (root) {
    await rm(root, { recursive: true, force: true })
  }
})

describe('performance output evidence', () => {
  it('detects lost content and configuration while ignoring JSON order and generated JS names', async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'performance-output-'))
    const directory = path.join(root, 'dist')
    await mkdir(directory)
    const put = (name: string, source: string) => writeFile(path.join(directory, name), source)
    await put('app.json', '{"pages":["index"]}')
    await put('index.js', 'Page({ message: "example" })')
    await put('index.wxml', '<view>retained</view>\r\n')
    await put('index.json', '{"navigationBarTitleText":"title","usingComponents":{}}')
    const initial = await captureOutputEvidence(root)
    await put('index.js', 'Page({message:"example"});')
    await put('index.json', '{"usingComponents":{},"navigationBarTitleText":"title"}')
    expect(await captureOutputEvidence(root)).toEqual(initial)
    await put('index.wxml', '<view></view>\r\n')
    expect((await captureOutputEvidence(root)).templateDigest).not.toBe(initial.templateDigest)
    await put('index.json', '{"navigationBarTitleText":"changed"}')
    expect((await captureOutputEvidence(root)).configDigest).not.toBe(initial.configDigest)
    await rm(path.join(directory, 'index.js'))
    await expect(captureOutputEvidence(root)).rejects.toThrow()
  })
})
