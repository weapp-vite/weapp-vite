import { describe, expect, it } from 'vitest'
import { generatedAgentGuidelines } from '../../packages/create-weapp-vite/src/generated/agents'
import { agentManifest } from './manifest'
import { AGENTS_GENERATED_MARKER, renderAgentDocument } from './render'
import { AgentManifestError, resolveLayer, validateManifest } from './resolve'

describe('agent manifest', () => {
  it('validates the repository manifest and resolves every layer', () => {
    expect(validateManifest(agentManifest).issues).toEqual([])
    expect(resolveLayer(agentManifest, 'root').map(section => section.id)).toContain('root.testing')
    expect(resolveLayer(agentManifest, 'weapp-vite').map(section => section.id)).toContain('weapp-vite.runtime')
    for (const layer of Object.keys(agentManifest.layers)) {
      expect(resolveLayer(agentManifest, layer).length).toBeGreaterThan(0)
    }
  })

  it('generates a profile for every create-weapp-vite template', () => {
    expect(Object.keys(generatedAgentGuidelines).sort()).toEqual(Object.keys(agentManifest.templates).sort())
    for (const content of Object.values(generatedAgentGuidelines)) {
      expect(content).toContain('agents-generated: v1')
      expect(content).toContain('## Local Overlay')
    }
  })

  it('detects duplicate sections and inheritance cycles', () => {
    const duplicate = {
      ...agentManifest,
      layers: {
        ...agentManifest.layers,
        duplicate: { include: ['shared.docs-first', 'shared.docs-first'] },
      },
    }
    expect(() => resolveLayer(duplicate, 'duplicate')).toThrow(AgentManifestError)

    const cycle = {
      ...agentManifest,
      layers: {
        ...agentManifest.layers,
        cycleA: { base: 'cycleB' },
        cycleB: { base: 'cycleA' },
      },
    }
    expect(() => resolveLayer(cycle, 'cycleA')).toThrow(/inheritance cycle/)
  })

  it('renders stable metadata and normalized line endings', () => {
    const rendered = renderAgentDocument(
      agentManifest,
      { title: 'Example', sections: [{ id: 'example', content: '## Rules\r\n\r\n- keep it stable' }] },
      'test:example',
    )
    expect(rendered).toContain(AGENTS_GENERATED_MARKER)
    expect(rendered).toContain('manifest-version: 1')
    expect(rendered).not.toContain('\r')
    expect(rendered.endsWith('\n')).toBe(true)
  })
})
