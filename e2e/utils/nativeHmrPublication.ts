import type { HmrRuntimeFallbackCode } from '../../packages/weapp-vite/src/runtime/hmrRuntimeCapabilities'
import type { launchAutomator } from './automator'
import type { startDevProcess } from './dev-process'
import { access, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY,
  WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY,
  WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE,
  WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY,
  WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE,
  WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE,
} from '@weapp-core/constants'
import { expect, vi } from 'vitest'
import { assertNoStatefulInstallations } from '../../packages/weapp-vite/scripts/consumerHmr/installedRuntime.mjs'
import { createDevBuildCompletion } from './devBuildCompletion'
import { captureNativePublication } from './nativePublication'

const fallbackPrefix = '[weapp-vite] HMR fallback '
const classicReadyPrefix = '[weapp-vite] HMR classic ready '
const statefulKeys = [WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY]

async function exists(file: string) {
  return access(file).then(() => true, (error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      return false
    }
    throw error
  })
}

/** 原生混合保存按实际发布模式交接；一旦 classic 就不再等待或安装旧 stateful owner。 */
export function createNativeHmrPublication(
  project: string,
  dev: ReturnType<typeof startDevProcess>,
  requested: 'auto' | 'classic' | 'stateful-experimental',
  fallbackReasons: readonly HmrRuntimeFallbackCode[] = ['config-json', 'entry-topology'],
  profilePath?: string,
) {
  // auto 场景仍以首构 control/runtime 断言确认初始 stateful，日志必须保留真实配置请求。
  let effective: 'classic' | 'stateful-experimental' = requested === 'classic' ? 'classic' : 'stateful-experimental'
  const readOutput = () => {
    const output = dev.getOutput()
    expect(output).not.toMatch(/Build failed|delivery failed|patch transform failed|classic HMR 切换失败|classic 回退失败/)
    return output
  }
  const updateMode = () => {
    const output = readOutput()
    if (output.includes(classicReadyPrefix)) {
      expect(requested).not.toBe('classic')
      expect(output.split(fallbackPrefix)).toHaveLength(2)
      expect(output.split(classicReadyPrefix)).toHaveLength(2)
      const fallback = output.match(/\[weapp-vite\] HMR fallback (\{[^\r\n]*\})/)
      const ready = output.match(/\[weapp-vite\] HMR classic ready (\{[^\r\n]*\})/)
      expect(fallback).not.toBeNull()
      expect(ready).not.toBeNull()
      const reason = JSON.parse(fallback![1]!) as Record<string, unknown>
      expect(reason).toEqual({
        from: 'stateful-experimental',
        to: 'classic',
        reason: reason.reason,
        message: expect.any(String),
        requested,
        actual: 'classic',
        phase: 'switching',
      })
      expect(fallbackReasons).toContain(reason.reason)
      expect(JSON.parse(ready![1]!) as unknown).toEqual({ reason: reason.reason, requested, actual: 'classic', phase: 'classic' })
      expect(fallback!.index).toBeLessThan(ready!.index!)
      effective = 'classic'
    }
    return effective
  }

  async function assertClassicOutput() {
    expect(updateMode()).toBe('classic')
    const output = readOutput()
    expect(output.split(fallbackPrefix)).toHaveLength(requested === 'classic' ? 1 : 2)
    expect(output.split(classicReadyPrefix)).toHaveLength(requested === 'classic' ? 1 : 2)
    const outDir = path.join(project, 'dist')
    for (const file of [WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE]) {
      await vi.waitFor(async () => {
        expect(await exists(path.join(outDir, file))).toBe(false)
      }, { timeout: 30_000 })
    }
    // Wevu 的普通注册代码保留 bridge 的只读能力探针；classic 不能安装交付客户端或控制器。
    // bridge 是否实际安装由 assertClassicRuntime 对全局及宿主对象分别核验。
    const scripts = (await readdir(outDir, { recursive: true })).filter(file => file.endsWith('.js'))
    expect(scripts.length).toBeGreaterThan(0)
    for (const file of scripts) {
      const source = await readFile(path.join(outDir, file), 'utf8')
      assertNoStatefulInstallations(file, source)
    }
  }

  return {
    get stateful() { return updateMode() === 'stateful-experimental' },
    async settleMode() {
      if (readOutput().includes(fallbackPrefix)) {
        await expect.poll(() => updateMode(), { timeout: 30_000 }).toBe('classic')
      }
    },
    capture(sourceFiles?: string | readonly string[]) {
      const outputOffset = readOutput().length
      const mode = updateMode()
      const files = typeof sourceFiles === 'string' ? [sourceFiles] : sourceFiles
      const publication = captureNativePublication(dev, project, {
        expectedSourceFiles: files,
        ...(mode === 'stateful-experimental'
          ? { allowSourceFreePublication: (receiptOffset: number) => readOutput().indexOf(classicReadyPrefix, outputOffset) >= receiptOffset }
          : {}),
      })
      const completion = profilePath && sourceFiles && createDevBuildCompletion(dev, {
        source: { files, profilePath },
      })
      return {
        async wait() {
          const receipt = await publication.wait(90_000)
          let needsSourceCompletion = mode === 'classic'
          if (mode === 'stateful-experimental') {
            // 首构的正式 END 先于新 ready；若最终收据更晚，必须另验该次 source END。
            await expect.poll(() => readOutput().slice(outputOffset).includes(classicReadyPrefix), { timeout: 90_000 }).toBe(true)
            expect(updateMode()).toBe('classic')
            needsSourceCompletion = readOutput().indexOf(classicReadyPrefix, outputOffset) < receipt.outputOffset
          }
          if (needsSourceCompletion) {
            if (!completion || !receipt.profileCursor) {
              throw new Error('Classic publication requires explicit source files, profile path and the native write profile cursor')
            }
            // 字节收据可先于后置写出失败；只读该次写出游标之后的 source complete。
            await completion.wait(90_000, receipt.sourcePublications ?? receipt.profileCursor)
          }
          await assertClassicOutput()
        },
      }
    },
    assertClassicOutput,
    async assertClassicRuntime(session: Awaited<ReturnType<typeof launchAutomator>>) {
      await assertClassicOutput()
      expect(await session.evaluate((keys: string[]) => keys.map(key => ({
        global: Boolean((globalThis as any)[key]),
        host: Boolean((globalThis as any).wx?.[key]),
      })), statefulKeys)).toEqual(statefulKeys.map(() => ({ global: false, host: false })))
    },
  }
}
