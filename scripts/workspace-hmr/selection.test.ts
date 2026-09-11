import { describe, expect, it } from 'vitest'
import { assertWorkspaceHmrSelection, resolveWorkspaceHmrSelection, selectWorkspaceHmrProjects } from './selection'

const projects = [
  { id: 'apps/runtime-demo', kind: 'apps' },
  { id: 'apps/react-demo', kind: 'apps' },
  { id: 'templates/react-template', kind: 'templates' },
]

describe('workspace HMR project selection', () => {
  it('preserves unfiltered and single-substring selections', () => {
    expect(selectWorkspaceHmrProjects(projects)).toEqual(projects)
    expect(selectWorkspaceHmrProjects(projects, '  ')).toEqual(projects)
    expect(selectWorkspaceHmrProjects(projects, 'react')).toEqual(projects.slice(1))
  })

  it('matches comma-separated ids across project groups without duplication', () => {
    expect(selectWorkspaceHmrProjects(projects, ' apps/runtime-demo, templates/react-template,apps/runtime-demo ')).toEqual([
      projects[0],
      projects[2],
    ])
  })

  it('rejects delimiter-only input instead of accidentally selecting the entire workspace', () => {
    expect(() => selectWorkspaceHmrProjects(projects, ' , , ')).toThrow('at least one project filter')
  })

  it('fails strict acceptance when a typo or an incompatible scope selects no projects', () => {
    const selected = selectWorkspaceHmrProjects(projects.filter(project => project.kind === 'apps'), 'templates/react-template')
    expect(selected).toEqual([])
    expect(() => assertWorkspaceHmrSelection(selected.length, true)).toThrow('non-empty run')
    expect(() => assertWorkspaceHmrSelection(selected.length, false)).not.toThrow()
    expect(() => assertWorkspaceHmrSelection(projects.length, true)).not.toThrow()
  })
})

describe('changed-project HMR acceptance', () => {
  it('records an intentional skip for unrelated changes without claiming acceptance', () => {
    const selection = resolveWorkspaceHmrSelection([], { hasRelevantChanges: false })
    expect(selection).toEqual({ projects: [], status: 'skipped-no-relevant-changes' })
    expect(() => assertWorkspaceHmrSelection(0, true, selection.status)).not.toThrow()
  })

  it('keeps explicit filters strict even when automatic change detection is unrelated', () => {
    const selection = resolveWorkspaceHmrSelection([], { hasRelevantChanges: false, filter: 'typo' })
    expect(selection.status).toBe('empty')
    expect(() => assertWorkspaceHmrSelection(0, true, selection.status)).toThrow('non-empty run')
    expect(() => resolveWorkspaceHmrSelection([], { hasRelevantChanges: false, filter: ', ,' })).toThrow('at least one project filter')
  })

  it('rejects missing projects, scope mismatches and empty smoke/full selections', () => {
    const selection = resolveWorkspaceHmrSelection([], { hasRelevantChanges: true })
    expect(selection.status).toBe('empty')
    expect(() => assertWorkspaceHmrSelection(0, true, selection.status)).toThrow('non-empty run')
  })

  it('requires acceptance whenever runnable projects were selected', () => {
    const selection = resolveWorkspaceHmrSelection(projects, { hasRelevantChanges: true })
    expect(selection.status).toBe('selected')
    expect(selection.projects).toEqual(projects)
  })
})
