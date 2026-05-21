import { Buffer } from 'node:buffer'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  readDevtoolsElementSnapshot,
  resolveDevtoolsProjectPath,
  resolveDevtoolsWorkspacePath,
  toDevtoolsSerializableValue,
} from '../src'

describe('devtools MCP helpers', () => {
  it('resolves project and workspace relative paths', () => {
    expect(resolveDevtoolsProjectPath('/workspace', 'apps/demo')).toBe(path.resolve('/workspace/apps/demo'))
    expect(resolveDevtoolsWorkspacePath('/workspace', 'screenshots/home.png')).toBe(path.resolve('/workspace/screenshots/home.png'))
  })

  it('serializes runtime values for MCP structured output', () => {
    expect(toDevtoolsSerializableValue({
      buffer: Buffer.from('png'),
      date: new Date('2026-05-21T00:00:00.000Z'),
      error: new TypeError('failed'),
      size: 12n,
    })).toMatchObject({
      buffer: Buffer.from('png').toString('base64'),
      date: '2026-05-21T00:00:00.000Z',
      error: {
        message: 'failed',
        name: 'TypeError',
      },
      size: '12',
    })
  })

  it('reads element snapshots with requested attributes and styles', async () => {
    const element = {
      attribute: vi.fn(async (name: string) => `attr:${name}`),
      offset: vi.fn(async () => ({ left: 1, top: 2 })),
      outerWxml: vi.fn(async () => '<button id="save">保存</button>'),
      size: vi.fn(async () => ({ height: 44, width: 88 })),
      style: vi.fn(async (name: string) => `style:${name}`),
      tagName: 'button',
      tap: vi.fn(async () => {}),
      text: vi.fn(async () => '保存'),
      value: vi.fn(async () => undefined),
      wxml: vi.fn(async () => '保存'),
    }

    await expect(readDevtoolsElementSnapshot(element, '#save', ['id'], ['display'])).resolves.toMatchObject({
      attributes: {
        id: 'attr:id',
      },
      offset: {
        left: 1,
        top: 2,
      },
      outerWxml: '<button id="save">保存</button>',
      selector: '#save',
      styles: {
        display: 'style:display',
      },
      tagName: 'button',
      text: '保存',
    })
  })
})
