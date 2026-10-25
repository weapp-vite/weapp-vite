import { describe, expect, it } from 'vitest'
import { createRuntimeState } from '../../runtime/runtimeState'
import { createAutoRoutesWebPublication, createAutoRoutesWebSourceSnapshot } from './publication'

function createState() {
  const state = createRuntimeState().autoRoutes
  state.signature = 'routes'
  state.pageDeclarationFingerprints.set('/project/src/pages/profile/index.vue', 'page')
  state.pageDeclarationFingerprints.set('/project/src/pageScripts/profile.mjs', 'script')
  return state
}

describe('complete auto routes Web publication snapshots', () => {
  it('captures every accepted source independently of watcher registrations and later scans', () => {
    const state = createState()
    state.watchFiles.add('/project/src/pages/profile/index.vue')
    state.pageDeclarationFingerprints.set('/project/src/pageTemplates/profile.html', 'template')
    state.pageDeclarationFingerprints.set('/project/src/pageStyles/profile.css', 'style')
    const snapshot = createAutoRoutesWebSourceSnapshot(state)

    expect(snapshot.signature).toBe('routes')
    expect(snapshot.fingerprints).toEqual(state.pageDeclarationFingerprints)
    expect(snapshot.fingerprints.size).toBe(4)
    state.signature = 'next-routes'
    state.pageDeclarationFingerprints.clear()
    expect(snapshot.signature).toBe('routes')
    expect(snapshot.fingerprints.size).toBe(4)
  })

  it('requires an initialized publication and preserves it through later virtual module loads', () => {
    const state = createState()
    const publication = createAutoRoutesWebPublication()
    const initial = createAutoRoutesWebSourceSnapshot(state)
    expect(publication.matches(initial)).toBe(false)
    publication.initialize(initial)
    expect(publication.matches(initial)).toBe(true)

    state.signature = 'next-routes'
    const next = createAutoRoutesWebSourceSnapshot(state)
    publication.initialize(next)
    expect(publication.signature).toBe('routes')
    expect(publication.matches(next)).toBe(false)
    publication.commit(next)
    expect(publication.matches(next)).toBe(true)
    publication.reset()
    expect(publication.signature).toBeUndefined()
    expect(publication.matches(next)).toBe(false)
  })

  it('recognizes an empty completed scan and detects deletion and restoration', () => {
    const state = createState()
    const publication = createAutoRoutesWebPublication()
    publication.commit(createAutoRoutesWebSourceSnapshot(state))

    state.pageDeclarationFingerprints.clear()
    const deleted = createAutoRoutesWebSourceSnapshot(state)
    expect(publication.matches(deleted)).toBe(false)
    publication.commit(deleted)
    expect(publication.matches(createAutoRoutesWebSourceSnapshot(state))).toBe(true)
    state.pageDeclarationFingerprints.set('/project/src/pages/profile/index.vue', 'restored')
    expect(publication.matches(createAutoRoutesWebSourceSnapshot(state))).toBe(false)
  })

  it.each(['content', 'rename', 'add', 'remove'] as const)('rejects a same-signature %s change in the complete source set', (change) => {
    const state = createState()
    const publication = createAutoRoutesWebPublication()
    publication.commit(createAutoRoutesWebSourceSnapshot(state))
    const page = '/project/src/pages/profile/index.vue'
    if (change === 'content') {
      state.pageDeclarationFingerprints.set(page, 'changed')
    }
    else if (change === 'rename') {
      state.pageDeclarationFingerprints.delete(page)
      state.pageDeclarationFingerprints.set('/project/src/pages/moved/index.vue', 'page')
    }
    else if (change === 'add') {
      state.pageDeclarationFingerprints.set('/project/src/pageTemplates/profile.html', 'template')
    }
    else {
      state.pageDeclarationFingerprints.delete(page)
    }
    expect(publication.matches(createAutoRoutesWebSourceSnapshot(state))).toBe(false)
  })

  it('ignores map insertion order and keeps a detached publication receipt', () => {
    const state = createState()
    const publication = createAutoRoutesWebPublication()
    const sources = new Map([...state.pageDeclarationFingerprints].reverse())
    publication.commit({ signature: state.signature, fingerprints: sources })
    expect(publication.matches(createAutoRoutesWebSourceSnapshot(state))).toBe(true)
    sources.clear()
    expect(publication.matches(createAutoRoutesWebSourceSnapshot(state))).toBe(true)
  })
})
