import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import logger from '../../../logger'
import { toPosixPath } from '../../../utils'
import {
  isSupportedSharedStyleExtension,
  normalizeSubPackageStyleEntries,
  resolveStyleEntryScope,
} from './index'

function createConfigService(absoluteSrcRoot: string) {
  return {
    absoluteSrcRoot,
    outputExtensions: {
      wxss: 'wxss',
    },
    relativeOutputPath(id: string) {
      const relative = path.relative(absoluteSrcRoot, id)
      if (relative.startsWith('..')) {
        return undefined
      }
      return relative.split(path.sep).join('/')
    },
  } as any
}

describe('normalizeSubPackageStyleEntries', () => {
  let tempRoot: string
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-style-entries-'))
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})

    await fs.mkdir(path.join(tempRoot, 'shared/styles'), { recursive: true })
    await fs.mkdir(path.join(tempRoot, 'packages/order/styles'), { recursive: true })
    await fs.writeFile(path.join(tempRoot, 'shared/styles/components.scss'), '')
    await fs.writeFile(path.join(tempRoot, 'packages/order/styles/theme.scss'), '')
  })

  afterEach(async () => {
    warnSpy.mockRestore()
    await fs.rm(tempRoot, { recursive: true, force: true })
  })

  it('detects supported shared style extensions case-insensitively', () => {
    expect(isSupportedSharedStyleExtension('/project/src/shared/index.scss')).toBe(true)
    expect(isSupportedSharedStyleExtension('/project/src/shared/index.WXSS')).toBe(true)
    expect(isSupportedSharedStyleExtension('/project/src/shared/index.ts')).toBe(false)
  })

  it('prefers explicit scope and otherwise infers scope from output path', () => {
    expect(resolveStyleEntryScope({
      source: 'shared/pages.scss',
      scope: 'all',
      explicitScope: false,
    } as any, 'packages/order/pages.wxss', 'packages/order')).toBe('pages')

    expect(resolveStyleEntryScope({
      source: 'shared/custom.scss',
      scope: 'components',
      explicitScope: true,
    } as any, 'packages/order/pages.wxss', 'packages/order')).toBe('components')
  })

  it('成功示例：存在的 ../../shared 样式入口会被收集并保留作用范围', () => {
    const entries = normalizeSubPackageStyleEntries(
      [
        {
          source: '../../shared/styles/components.scss',
          scope: 'components',
          include: ['components/**'],
        },
      ],
      { root: 'packages/order' } as any,
      createConfigService(tempRoot),
    )

    expect(entries).toEqual([
      {
        source: '../../shared/styles/components.scss',
        absolutePath: toPosixPath(path.join(tempRoot, 'shared/styles/components.scss')),
        outputRelativePath: 'shared/styles/components.wxss',
        inputExtension: '.scss',
        scope: 'components',
        include: ['components/**'],
        exclude: [],
      },
    ])
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('失败示例：不存在的 ../shared 样式入口会输出文件不存在告警并被忽略', () => {
    const entries = normalizeSubPackageStyleEntries(
      [
        {
          source: '../shared/styles/components.scss',
          scope: 'components',
          include: ['components/**'],
        },
      ],
      { root: 'packages/order' } as any,
      createConfigService(tempRoot),
    )

    expect(entries).toBeUndefined()
    expect(warnSpy).toHaveBeenCalledWith(
      '[分包] 分包 packages/order 样式入口 `../shared/styles/components.scss` 对应文件不存在，已忽略。',
    )
  })
})
