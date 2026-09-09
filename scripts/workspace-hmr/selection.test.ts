import { describe, expect, it } from 'vitest'
import { assertWorkspaceHmrSelection, selectWorkspaceHmrProjects } from './selection'

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
