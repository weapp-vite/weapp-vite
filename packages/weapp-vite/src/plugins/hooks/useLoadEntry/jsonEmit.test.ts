import { describe, expect, it } from 'vitest'
import { createJsonEmitManager } from './jsonEmit'

describe('createJsonEmitManager', () => {
  it('normalizes json file names through relative output helper', () => {
    const manager = createJsonEmitManager({
      relativeOutputPath(filePath: string) {
        return filePath.replace('/project/src/', '')
      },
    } as any)

    manager.register({
      type: 'page',
      json: { navigationBarTitleText: '首页' },
      jsonPath: '/project/src/pages/home/index.json.js',
    })

    expect(Array.from(manager.map.keys())).toEqual(['pages/home/index.json'])
    expect(manager.map.get('pages/home/index.json')).toMatchObject({
      fileName: 'pages/home/index.json',
      entry: {
        type: 'page',
        jsonPath: '/project/src/pages/home/index.json.js',
      },
    })
  })

  it('skips entries without jsonPath', () => {
    const manager = createJsonEmitManager({
      relativeOutputPath(filePath: string) {
        return filePath
      },
    } as any)

    manager.register({
      type: 'component',
      json: {},
    })

    expect(manager.map.size).toBe(0)
  })
})
