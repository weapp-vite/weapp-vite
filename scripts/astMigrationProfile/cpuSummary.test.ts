import type { Profiler } from 'node:inspector'
import { describe, expect, it } from 'vitest'
import { summarizeCpuProfile } from './cpuSummary'

function node(id: number, functionName: string, url = '', children?: number[]): Profiler.ProfileNode {
  return {
    id,
    callFrame: { functionName, url, scriptId: 'fixture', lineNumber: 0, columnNumber: 2 },
    hitCount: 999,
    ...(children === undefined ? {} : { children }),
  }
}

function profile(nodes: Profiler.ProfileNode[], samples?: number[]): Profiler.Profile {
  return { nodes, startTime: 0, endTime: 1000, ...(samples === undefined ? {} : { samples }) }
}

describe('CPU sample attribution', () => {
  it('counts sampled leaves and deduplicates recursive module/function inclusive samples', () => {
    const input = profile([
      node(1, '(root)', '', [2, 5, 6, 7, 8]),
      node(2, 'compile', '/repo/src/compiler.ts', [3]),
      node(3, 'parse', '/repo/node_modules/parser/index.js', [4]),
      node(4, 'compile', '/repo/src/compiler.ts'),
      node(5, '(garbage collector)'),
      node(6, '(idle)'),
      node(7, '(program)'),
      node(8, 'unknownBuiltin'),
    ], [4, 4, 2, 3, 5, 6, 7, 8])
    const result = summarizeCpuProfile(input, '/repo')
    const compiler = result.modules.find(entry => entry.module === 'src/compiler.ts')!
    expect(result.totalSamples).toBe(8)
    expect(compiler).toMatchObject({
      category: 'repository',
      sampleCount: 3,
      selfSamples: 3,
      inclusiveSamples: 4,
      percentOfAllSamples: 37.5,
      inclusivePercentOfAllSamples: 50,
    })
    expect(compiler.topFunctions).toHaveLength(1)
    expect(compiler.topFunctions[0]).toMatchObject({
      functionName: 'compile',
      selfSamples: 3,
      inclusiveSamples: 4,
      url: 'src/compiler.ts',
      line: 1,
      column: 3,
    })
    expect(result.modules.find(entry => entry.category === 'dependency')).toMatchObject({ selfSamples: 1, inclusiveSamples: 3 })
    for (const category of ['gc', 'idle', 'program', 'unattributed']) {
      expect(result.modules.find(entry => entry.category === category)).toMatchObject({ selfSamples: 1, inclusiveSamples: 1 })
    }
    expect(result.modules.find(entry => entry.category === 'root')).toMatchObject({ selfSamples: 0, inclusiveSamples: 8 })
    expect(result.modules.reduce((sum, entry) => sum + entry.selfSamples, 0)).toBe(result.totalSamples)
    expect(input.nodes[0]!.hitCount).toBe(999)
  })

  it.each([
    ['/private-user/project', 'file:///private-user/project/src/a%20b.ts?private=query', '/private-user/project/node_modules/.pnpm/parser@1/node_modules/@scope/parser/index.js'],
    ['C:\\private-user\\project', 'file:///c:/private-user/project/src/a%20b.ts?private=query', 'C:\\private-user\\project\\node_modules\\.pnpm\\parser@1\\node_modules\\@scope\\parser\\index.js'],
  ])('normalizes repository and package sources without leaking the root: %s', (root, source, dependency) => {
    const input = profile([
      node(1, '(root)', '', [2, 3, 4, 5, 6, 7]),
      node(2, 'compile', source),
      node(3, 'parse', dependency),
      node(4, 'processTicks', 'node:internal/process/task_queues'),
      node(5, 'private-user/path/function', '/outside/private-user/secret.js'),
      node(6, 'fetch', 'https://private-user:password@example.invalid/private-path/source.js?secret=value'),
      node(7, 'neighbor', `${root.replaceAll('\\', '/')}-other/src/neighbor.ts`),
    ], [2, 3, 4, 5, 6, 7])
    const result = summarizeCpuProfile(input, root)
    expect(result.modules).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'repository', module: 'src/a b.ts' }),
      expect.objectContaining({ category: 'dependency', module: 'node_modules/@scope/parser/index.js' }),
      expect.objectContaining({ category: 'node-builtin', module: 'node:internal/process/task_queues' }),
      expect.objectContaining({ category: 'external-file', module: expect.stringMatching(/^<external-file:[a-f0-9]{12}>$/) }),
      expect.objectContaining({ category: 'external-url', module: expect.stringMatching(/^<external-url:[a-f0-9]{12}>$/) }),
    ]))
    const serialized = JSON.stringify(result)
    for (const secret of ['private-user', 'password', 'example.invalid', 'private-path', 'secret.js', '.pnpm', 'private=query', 'project-other']) {
      expect(serialized).not.toContain(secret)
    }
    expect(result).toEqual(summarizeCpuProfile(input, root))
  })

  it('keeps unknown positions and unknown URL-less functions explicitly unattributed', () => {
    const frame = node(2, 'constructor')
    frame.callFrame.lineNumber = -1
    frame.callFrame.columnNumber = -1
    const result = summarizeCpuProfile(profile([node(1, '(root)', '', [2]), frame], [2]), '/repo')
    expect(result.topFunctions[0]).toMatchObject({
      functionName: 'constructor',
      category: 'unattributed',
      line: null,
      column: null,
    })
  })

  it('ranks the top 20 functions by self samples while retaining every module', () => {
    const leaves = Array.from({ length: 25 }, (_, index) => node(index + 2, `method${index}`, `/repo/src/module${index}.ts`))
    const samples = leaves.flatMap((entry, index) => Array.from<number>({ length: index + 1 }).fill(entry.id))
    const result = summarizeCpuProfile(profile([node(1, '(root)', '', leaves.map(entry => entry.id)), ...leaves], samples), '/repo')
    expect(result.topFunctions).toHaveLength(20)
    expect(result.topFunctions[0]).toMatchObject({ functionName: 'method24', selfSamples: 25 })
    expect(result.topFunctions.at(-1)).toMatchObject({ functionName: 'method5', selfSamples: 6 })
    expect(result.modules).toHaveLength(26)
  })

  it.each([
    ['missing samples', profile([node(1, '(root)')])],
    ['empty samples', profile([node(1, '(root)')], [])],
    ['unknown sampled node', profile([node(1, '(root)')], [2])],
    ['duplicate node id', profile([node(1, '(root)'), node(1, 'duplicate')], [1])],
    ['unknown child', profile([node(1, '(root)', '', [2])], [1])],
    ['duplicate child', profile([node(1, '(root)', '', [2, 2]), node(2, 'child')], [2])],
    ['shared child', profile([node(1, '(root)', '', [2, 3]), node(2, 'a', '', [4]), node(3, 'b', '', [4]), node(4, 'child')], [4])],
    ['cycle', profile([node(1, 'a', '', [2]), node(2, 'b', '', [1])], [1])],
    ['disconnected cycle', profile([node(1, '(root)'), node(2, 'a', '', [3]), node(3, 'b', '', [2])], [1])],
    ['multiple roots', profile([node(1, '(root)'), node(2, 'other')], [1])],
  ])('rejects %s rather than estimating from hitCount', (_name, input) => {
    expect(() => summarizeCpuProfile(input, '/repo')).toThrow(/CPU profile/)
  })
})
