import type { Page as PageJson } from '@weapp-core/schematics'
import type { MpPlatform } from '@weapp-core/shared'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect } from 'vitest'
import { replaceFileByRename } from '../../utils/hmr-helpers'

export const PLATFORM_TEMPLATE_EXT: Record<RuntimePlatform, string> = {
  weapp: 'wxml',
  alipay: 'axml',
  tt: 'ttml',
}

export type RuntimePlatform = Extract<MpPlatform, 'weapp' | 'alipay' | 'tt'>

export function resolveVueComponentKey(name: string) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
}

export function resolveNativeComponentKey(platform: RuntimePlatform, name: string) {
  if (platform !== 'alipay') {
    return name
  }
  return resolveVueComponentKey(name)
}

export async function waitForFileContains(
  filePath: string,
  markers: string[],
  timeoutMs = 90_000,
) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await fs.pathExists(filePath)) {
      const content = await fs.readFile(filePath, 'utf8')
      if (markers.every(marker => content.includes(marker))) {
        return content
      }
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(
    `Timed out waiting for ${filePath} to contain expected markers.`,
  )
}

export async function waitForFileRead(filePath: string, timeoutMs = 30_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      return await fs.readFile(filePath, 'utf8')
    }
    catch {
      await new Promise(resolve => setTimeout(resolve, 250))
    }
  }
  return await fs.readFile(filePath, 'utf8')
}

export async function waitForUsingComponent(
  pageJsonPath: string,
  name: string,
  value: string,
  timeoutMs = 90_000,
) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await fs.pathExists(pageJsonPath)) {
      const pageJson = await fs.readJson(pageJsonPath) as PageJson
      if (pageJson?.usingComponents?.[name] === value) {
        return pageJson
      }
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(
    `Timed out waiting for usingComponents.${name} in ${pageJsonPath}`,
  )
}

export async function waitForMissingUsingComponent(
  pageJsonPath: string,
  name: string,
  timeoutMs = 90_000,
) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await fs.pathExists(pageJsonPath)) {
      const pageJson = await fs.readJson(pageJsonPath) as PageJson
      if (!pageJson?.usingComponents || !(name in pageJson.usingComponents)) {
        return pageJson
      }
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(
    `Timed out waiting for usingComponents.${name} to be removed in ${pageJsonPath}`,
  )
}

export function detectEol(source: string) {
  return source.includes('\r\n') ? '\r\n' : '\n'
}

export function insertVueTemplateHeartbeat(source: string, marker: string, eol: string) {
  const templateCloseIndex = source.lastIndexOf('</template>')
  if (templateCloseIndex < 0) {
    return `${source}${eol}<!-- ${marker} -->${eol}`
  }

  return `${source.slice(0, templateCloseIndex)}${eol}<view style="display: none;">${marker}</view>${eol}${source.slice(templateCloseIndex)}`
}

export async function rewriteVueSourceForWatch(
  sourcePath: string,
  targetSource: string,
) {
  const eol = detectEol(targetSource)
  const marker = `auto-import-e2e-retry-${Date.now()}`
  await replaceFileByRename(
    sourcePath,
    insertVueTemplateHeartbeat(targetSource, marker, eol),
  )
  await new Promise(resolve => setTimeout(resolve, 120))
  await replaceFileByRename(sourcePath, targetSource)
}

export async function waitForTaskWithSourceHeartbeat<T>(
  task: () => Promise<T>,
  touchFilePath: string,
  touchContent: string,
  timeoutMs = 60_000,
  heartbeatMs = 2_000,
) {
  const deadline = Date.now() + timeoutMs
  let nextTouchAt = Date.now() + heartbeatMs

  while (Date.now() < deadline) {
    try {
      return await task()
    }
    catch {
      if (Date.now() >= nextTouchAt) {
        await rewriteVueSourceForWatch(touchFilePath, touchContent)
        nextTouchAt = Date.now() + heartbeatMs
      }
      await new Promise(resolve => setTimeout(resolve, 250))
    }
  }

  return await task()
}

export async function waitForTaskWithSourceHeartbeats<T>(
  task: () => Promise<T>,
  heartbeatInputs: Array<{
    touchContent: string
    touchFilePath: string
  }>,
  timeoutMs = 60_000,
  heartbeatMs = 2_000,
) {
  const deadline = Date.now() + timeoutMs
  let nextTouchAt = Date.now() + heartbeatMs

  while (Date.now() < deadline) {
    try {
      return await task()
    }
    catch {
      if (Date.now() >= nextTouchAt) {
        for (const heartbeatInput of heartbeatInputs) {
          await rewriteVueSourceForWatch(
            heartbeatInput.touchFilePath,
            heartbeatInput.touchContent,
          )
        }
        nextTouchAt = Date.now() + heartbeatMs
      }
      await new Promise(resolve => setTimeout(resolve, 250))
    }
  }

  return await task()
}

export function createHotCardSfc() {
  return `<template>
  <view class="hot-card-e2e">
    hot-card-e2e
  </view>
</template>
`
}

export function toCrlf(source: string) {
  return source.replace(/\r?\n/g, '\r\n')
}

export function removeStandaloneTagLine(source: string, tagName: string) {
  const tagPattern = new RegExp(`^[ \\t]*<${tagName}\\s*\\/>\\r?\\n?`, 'm')
  return source.replace(tagPattern, '')
}

export function insertStandaloneTagAfter(
  source: string,
  anchorTagName: string,
  tagName: string,
) {
  const eol = detectEol(source)
  const anchorPattern = new RegExp(
    `^([ \\t]*)<${anchorTagName}\\s*\\/>\\r?$`,
    'm',
  )
  return source.replace(
    anchorPattern,
    (_line, indent: string) =>
      `${indent}<${anchorTagName} />${eol}${indent}<${tagName} />`,
  )
}

export const FULL_SCAN_HMR_EMIT_RE = /hmr emit dirty=(\d+) resolved=(\d+) emitAll=true pending=(\d+) registration=(\d+) scan=full/
export const TARGETED_HMR_EMIT_RE = /hmr emit dirty=(\d+) resolved=(\d+) emitAll=false pending=(\d+)/

export async function waitForOutputSince(
  dev: { getOutput: () => string },
  startOffset: number,
  matcher: RegExp,
  timeoutMs = 30_000,
) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const nextOutput = dev.getOutput().slice(startOffset)
    if (matcher.test(nextOutput)) {
      return nextOutput
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for dev output since offset to match: ${matcher}`)
}

export function expectFullScanHmrEmit(output: string) {
  const matches = [...output.matchAll(new RegExp(FULL_SCAN_HMR_EMIT_RE, 'g'))]
  const match = matches.at(-1)
  expect(match).toBeDefined()
  const [, dirtyCount, resolvedCount, pendingCount, registrationCount] = match!
  expect(Number(dirtyCount)).toBeGreaterThanOrEqual(0)
  expect(Number(resolvedCount)).toBeGreaterThan(0)
  expect(Number(pendingCount)).toBe(Number(resolvedCount))
  expect(Number(registrationCount)).toBe(Number(resolvedCount))
}

export function expectTargetedHmrEmit(output: string) {
  const matches = [...output.matchAll(new RegExp(TARGETED_HMR_EMIT_RE, 'g'))]
  const match = matches.at(-1)
  expect(match).toBeDefined()
  const [, dirtyCount, resolvedCount, pendingCount] = match!
  expect(Number(dirtyCount)).toBeGreaterThan(0)
  expect(Number(pendingCount)).toBeGreaterThan(0)
  expect(Number(pendingCount)).toBeLessThan(Number(resolvedCount))
}

/** 引用图的每个逻辑入口均应由 bundler 写出完整的脚本、配置和平台模板。 */
export async function expectPageComponentAssets(
  distRoot: string,
  pageJsonPath: string,
  platform: RuntimePlatform,
) {
  const pageJson = await fs.readJson(pageJsonPath) as PageJson
  const entryBases = new Set([
    pageJsonPath.slice(0, -'.json'.length),
    ...Object.values(pageJson.usingComponents ?? {}).map(reference => reference.startsWith('/')
      ? path.join(distRoot, reference.slice(1))
      : path.resolve(path.dirname(pageJsonPath), reference)),
  ])
  for (const entryBase of entryBases) {
    for (const extension of ['js', 'json', PLATFORM_TEMPLATE_EXT[platform]]) {
      const assetPath = `${entryBase}.${extension}`
      expect(await fs.pathExists(assetPath), path.relative(distRoot, assetPath)).toBe(true)
    }
  }
  return pageJson
}
