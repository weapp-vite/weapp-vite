import type { ChokidarOptions } from 'chokidar'
import type { Stats } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isPhysicalViteWatchPlanCurrent, planPhysicalViteWatchTargets } from './physical'

const mocks = vi.hoisted(() => ({ stat: vi.fn<(file: string) => Promise<Stats>>() }))
vi.mock('node:fs/promises', () => ({ stat: mocks.stat }))

function directory(ino = 1): Stats {
  return { dev: 2, ino, isDirectory: () => true } as Stats
}

function failure(code: string) {
  return Object.assign(new Error(code), { code })
}

function fixture(entries: Record<string, Stats | Error>) {
  mocks.stat.mockImplementation(async (file) => {
    const entry = entries[file]
    if (entry instanceof Error) {
      throw entry
    }
    if (!entry) {
      throw failure('ENOENT')
    }
    return entry
  })
}

function ignored(options: ChokidarOptions) {
  return options.ignored as (file: string, stats?: Stats) => boolean
}

beforeEach(() => vi.clearAllMocks())

describe('Vite physical input planning', () => {
  it('groups missing logical inputs under existing directory ancestors', async () => {
    fixture({ '/workspace': directory(), '/workspace/not-directory': { isDirectory: () => false } as Stats })
    const targets = ['/workspace/environment/.env', '/workspace/environment/.env.local', '/workspace/not-directory/input.ts']
    const plans = await planPhysicalViteWatchTargets(targets, {}, () => true, () => true)
    expect(plans).toHaveLength(1)
    expect(plans[0]).toMatchObject({ root: '/workspace', targets, identity: { dev: 2, ino: 1 } })
    expect(mocks.stat).not.toHaveBeenCalledWith('/workspace/environment/.env')
    expect(ignored(plans[0]!.options)('/workspace/unrelated/tree')).toBe(true)
  })

  it('merges overlapping physical roots into the outer owner without losing logical depth', async () => {
    fixture({ '/workspace': directory(1), '/workspace/project': directory(2), '/workspace/external': directory(3) })
    const targets = ['/workspace/project', '/workspace/project/config.ts', '/workspace/external/config.ts']
    const plans = await planPhysicalViteWatchTargets(targets, { depth: 0 }, () => true, () => true)
    expect(plans).toHaveLength(1)
    const [plan] = plans
    expect(plan).toMatchObject({ root: '/workspace', identity: { dev: 2, ino: 1 }, options: { depth: 2 } })
    expect(plan!.targets).toEqual(targets)
    const excludes = ignored(plan!.options)
    expect(excludes('/workspace/project/config.ts')).toBe(false)
    expect(excludes('/workspace/project/child/file.ts')).toBe(true)
    expect(excludes('/workspace/external/config.ts')).toBe(false)
    expect(excludes('/workspace/external/other.ts')).toBe(true)
  })

  it('bypasses ignored only for synthetic ancestors and retains live exclusions', async () => {
    fixture({ '/workspace': directory() })
    const excluded = new Set<string>()
    const userIgnored = vi.fn((file: string) => file === '/workspace' || file.endsWith('.local'))
    const [plan] = await planPhysicalViteWatchTargets(['/workspace/environment/.env', '/workspace/environment/.env.local'], { ignored: userIgnored }, file => !excluded.has(file), () => true)
    expect(userIgnored).toHaveBeenCalledWith('/workspace/environment/.env', undefined)
    expect(userIgnored).toHaveBeenCalledWith('/workspace/environment/.env.local', undefined)
    userIgnored.mockClear()
    const excludes = ignored(plan!.options)
    expect(excludes('/workspace')).toBe(false)
    expect(excludes('/workspace/environment')).toBe(false)
    expect(userIgnored).not.toHaveBeenCalled()
    const stats = directory()
    expect(excludes('/workspace/environment/.env', stats)).toBe(false)
    expect(userIgnored).toHaveBeenLastCalledWith('/workspace/environment/.env', stats)
    expect(excludes('/workspace/environment/.env.local')).toBe(true)
    excluded.add('/workspace/environment/.env')
    excluded.add('/workspace/environment/.env.local')
    expect(excludes('/workspace/environment')).toBe(true)
  })

  it('preserves cwd spelling and applies depth at each logical target', async () => {
    fixture({ '/project': directory() })
    const options = { cwd: '/project', depth: 1 }
    const [plan] = await planPhysicalViteWatchTargets(['feature/source', 'feature/second/deep'], options, () => true, () => true)
    expect(plan!.targets).toEqual(['/project/feature/source', '/project/feature/second/deep'])
    expect(plan!.options).toMatchObject({ cwd: '/project', depth: 4 })
    expect(options.depth).toBe(1)
    const excludes = ignored(plan!.options)
    expect(excludes('feature/source/file.ts')).toBe(false)
    expect(excludes('feature/source/one/file.ts')).toBe(false)
    expect(excludes('feature/source/one/two/file.ts')).toBe(true)
    expect(excludes('feature/second/deep/one/file.ts')).toBe(false)
    expect(excludes('feature/other')).toBe(true)
  })

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('keeps original unsupported or infinite depth %s', async (depth) => {
    fixture({ '/project': directory() })
    const [plan] = await planPhysicalViteWatchTargets(['/project/source/file.ts'], { depth }, () => true, () => true)
    expect(Object.is(plan!.options.depth, depth)).toBe(true)
  })

  it('keeps the largest valid depth valid after adding ancestor distance', async () => {
    fixture({ '/project': directory() })
    const [plan] = await planPhysicalViteWatchTargets(['/project/source/file.ts'], { depth: Number.MAX_SAFE_INTEGER }, () => true, () => true)
    expect(plan!.options.depth).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('preserves permission and other original errors instead of climbing past them', async () => {
    const permission = failure('EACCES')
    fixture({ '/workspace/denied': permission, '/workspace': directory() })
    await expect(planPhysicalViteWatchTargets(['/workspace/denied/input'], {}, () => true, () => true)).rejects.toBe(permission)
    await expect(planPhysicalViteWatchTargets(['/workspace/denied/input'], { ignorePermissionErrors: true }, () => true, () => true)).resolves.toEqual([])
    expect(mocks.stat).not.toHaveBeenCalledWith('/workspace')
    const original = failure('EIO')
    fixture({ '/workspace/denied': original })
    await expect(planPhysicalViteWatchTargets(['/workspace/denied/input'], { ignorePermissionErrors: true }, () => true, () => true)).rejects.toBe(original)
  })

  it('skips a definitely ignored logical input before looking up its denied parent', async () => {
    fixture({ '/project/denied': failure('EACCES') })
    const ignoredInput = vi.fn((file: string) => file === '/project/denied/input.ts')
    await expect(planPhysicalViteWatchTargets(['/project/denied/input.ts'], { ignored: ignoredInput }, () => true, () => true)).resolves.toEqual([])
    expect(ignoredInput).toHaveBeenCalledExactlyOnceWith('/project/denied/input.ts', undefined)
    expect(mocks.stat).not.toHaveBeenCalled()
  })

  it('keeps stats-dependent ignored decisions until real directory information is available', async () => {
    fixture({ '/project': directory() })
    const ignoredInput = vi.fn((_file: string, stats?: Stats) => stats?.isDirectory() === true)
    const [plan] = await planPhysicalViteWatchTargets(['/project/feature'], { ignored: ignoredInput }, () => true, () => true)
    expect(plan).toBeDefined()
    expect(ignoredInput).toHaveBeenCalledWith('/project/feature', undefined)
    expect(ignored(plan!.options)('/project/feature', directory())).toBe(true)
    expect(plan!.reachable('/project/feature/file.ts')).toBe(false)
  })

  it('allows an ignored empty file to acquire fresh stats before restoring event ownership', async () => {
    fixture({ '/project': directory() })
    const ignoredInput = (_file: string, stats?: Stats) => stats?.isFile() === true && stats.size === 0
    const [plan] = await planPhysicalViteWatchTargets(['/project/source'], { ignored: ignoredInput }, () => true, () => true)
    const excludes = ignored(plan!.options)
    const file = '/project/source/entry.ts'
    const empty = { isFile: () => true, size: 0 } as Stats
    const content = { isFile: () => true, size: 1 } as Stats
    expect(excludes(file, empty)).toBe(true)
    expect(plan!.reachable(file)).toBe(false)
    expect(excludes(file)).toBe(false)
    expect(plan!.reachable(file)).toBe(false)
    expect(excludes(file, content)).toBe(false)
    expect(plan!.reachable(file)).toBe(true)
  })

  it('keeps an ignored directory ancestor pruned during statless candidate rechecks', async () => {
    fixture({ '/project': directory() })
    const ignoredInput = (file: string, stats?: Stats) => file === '/project/source/generated' && stats?.isDirectory() === true
    const [plan] = await planPhysicalViteWatchTargets(['/project/source'], { ignored: ignoredInput }, () => true, () => true)
    const excludes = ignored(plan!.options)
    expect(excludes('/project/source/generated', directory())).toBe(true)
    expect(excludes('/project/source/generated')).toBe(false)
    expect(excludes('/project/source/generated/unrelated.ts')).toBe(true)
    expect(plan!.reachable('/project/source/generated/unrelated.ts')).toBe(false)
  })

  it('climbs ENOTDIR and preserves the original missing error at the filesystem root', async () => {
    fixture({ '/workspace/removed': failure('ENOTDIR'), '/workspace': directory() })
    const [plan] = await planPhysicalViteWatchTargets(['/workspace/removed/input'], {}, () => true, () => true)
    expect(plan!.root).toBe('/workspace')
    const original = failure('ENOENT')
    fixture({ '/': original })
    await expect(planPhysicalViteWatchTargets(['/input'], {}, () => true, () => true)).rejects.toBe(original)
  })

  it('discards in-flight plans after cancellation or logical unwatch', async () => {
    const stats = Promise.withResolvers<Stats>()
    mocks.stat.mockReturnValue(stats.promise)
    let active = true
    const planning = planPhysicalViteWatchTargets(['/project/source.ts'], {}, () => true, () => active)
    active = false
    stats.resolve(directory())
    await expect(planning).resolves.toEqual([])
    let accepted = true
    const next = Promise.withResolvers<Stats>()
    mocks.stat.mockReturnValue(next.promise)
    const unwatched = planPhysicalViteWatchTargets(['/project/source.ts'], {}, () => accepted, () => true)
    accepted = false
    next.resolve(directory())
    await expect(unwatched).resolves.toEqual([])
  })

  it('rechecks earlier targets after a later target finishes planning', async () => {
    const next = Promise.withResolvers<Stats>()
    mocks.stat.mockResolvedValueOnce(directory()).mockReturnValueOnce(next.promise)
    let accepted = true
    const planning = planPhysicalViteWatchTargets(['/project/first.ts', '/project/second.ts'], {}, file => !file.endsWith('/first.ts') || accepted, () => true)
    await Promise.resolve()
    accepted = false
    next.resolve(directory())
    const [plan] = await planning
    expect(plan!.targets).toEqual(['/project/second.ts'])
  })

  it('preserves a late permission error after planning cancellation', async () => {
    const stats = Promise.withResolvers<Stats>()
    mocks.stat.mockReturnValue(stats.promise)
    let active = true
    const original = failure('EACCES')
    const planning = planPhysicalViteWatchTargets(['/project/source.ts'], {}, () => true, () => active)
    active = false
    stats.reject(original)
    await expect(planning).rejects.toBe(original)
  })

  it('rechecks selected directory identity and disappearance before dispatch', async () => {
    fixture({ '/project': directory() })
    const [plan] = await planPhysicalViteWatchTargets(['/project/input.ts'], {}, () => true, () => true)
    await expect(isPhysicalViteWatchPlanCurrent(plan!)).resolves.toBe(true)
    fixture({ '/project': directory(2) })
    await expect(isPhysicalViteWatchPlanCurrent(plan!)).resolves.toBe(false)
    fixture({ '/project': failure('ENOENT') })
    await expect(isPhysicalViteWatchPlanCurrent(plan!)).resolves.toBe(false)
    const original = failure('EPERM')
    fixture({ '/project': original })
    await expect(isPhysicalViteWatchPlanCurrent(plan!)).rejects.toBe(original)
  })

  it('rejects uncompiled ignored rules explicitly', async () => {
    fixture({ '/project': directory() })
    await expect(planPhysicalViteWatchTargets(['/project/input.ts'], { ignored: '*.ts' }, () => true, () => true)).rejects.toThrow('compiled ignored function')
  })
})
