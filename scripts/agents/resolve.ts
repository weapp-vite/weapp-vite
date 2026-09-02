import type {
  AgentManifest,
  ResolvedAgentSection,
} from './types'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

export class AgentManifestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentManifestError'
  }
}

function contentPath(manifest: AgentManifest, id: string) {
  const section = manifest.sections[id]
  if (!section) {
    throw new AgentManifestError(`unknown section: ${id}`)
  }
  return path.resolve(process.cwd(), section.contentFile)
}

function sectionFileLabel(filePath: string) {
  return path.relative(process.cwd(), filePath) || filePath
}

function readSection(manifest: AgentManifest, id: string) {
  const filePath = contentPath(manifest, id)
  if (!fs.existsSync(filePath)) {
    throw new AgentManifestError(`section ${id} content file does not exist: ${sectionFileLabel(filePath)}`)
  }
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n').trim()
}

function applyLayer(
  manifest: AgentManifest,
  layerName: string,
  stack: string[],
): ResolvedAgentSection[] {
  const layer = manifest.layers[layerName]
  if (!layer) {
    throw new AgentManifestError(`unknown layer: ${layerName}`)
  }
  if (stack.includes(layerName)) {
    throw new AgentManifestError(`layer inheritance cycle: ${[...stack, layerName].join(' -> ')}`)
  }

  const sections = layer.base
    ? applyLayer(manifest, layer.base, [...stack, layerName])
    : []
  const byId = new Map(sections.map(section => [section.id, section]))
  const order = sections.map(section => section.id)

  for (const id of layer.include ?? []) {
    if (byId.has(id)) {
      throw new AgentManifestError(`layer ${layerName} includes duplicate section: ${id}`)
    }
    byId.set(id, { id, content: readSection(manifest, id) })
    order.push(id)
  }

  for (const [targetId, replacementId] of Object.entries(layer.replace ?? {})) {
    if (!byId.has(targetId)) {
      throw new AgentManifestError(`layer ${layerName} replaces missing section: ${targetId}`)
    }
    if (targetId === replacementId) {
      throw new AgentManifestError(`layer ${layerName} replaces section with itself: ${targetId}`)
    }
    if (manifest.sections[replacementId] === undefined) {
      throw new AgentManifestError(`layer ${layerName} replaces ${targetId} with unknown section: ${replacementId}`)
    }
    byId.set(targetId, { id: targetId, content: readSection(manifest, replacementId) })
  }

  for (const id of layer.remove ?? []) {
    if (!byId.has(id)) {
      throw new AgentManifestError(`layer ${layerName} removes missing section: ${id}`)
    }
    byId.delete(id)
  }

  return order.filter(id => byId.has(id)).map(id => byId.get(id)!)
}

export function validateManifest(manifest: AgentManifest) {
  const issues: string[] = []
  if (manifest.version !== 1) {
    issues.push(`unsupported manifest version: ${manifest.version}`)
  }
  if (!manifest.generatorVersion.trim()) {
    issues.push('generatorVersion must be non-empty')
  }
  const sectionIds = Object.keys(manifest.sections)
  for (const [id, section] of Object.entries(manifest.sections)) {
    if (id !== section.id) {
      issues.push(`section key/id mismatch: ${id} != ${section.id}`)
    }
    if (!section.contentFile) {
      issues.push(`section ${id} has no contentFile`)
    }
  }
  for (const [layerName, layer] of Object.entries(manifest.layers)) {
    if (layer.base && !manifest.layers[layer.base]) {
      issues.push(`layer ${layerName} has unknown base: ${layer.base}`)
    }
    for (const id of [...layer.include ?? [], ...layer.remove ?? []]) {
      if (!manifest.sections[id]) {
        issues.push(`layer ${layerName} references unknown section: ${id}`)
      }
    }
    for (const [targetId, replacementId] of Object.entries(layer.replace ?? {})) {
      if (!manifest.sections[targetId] || !manifest.sections[replacementId]) {
        issues.push(`layer ${layerName} has invalid replacement: ${targetId} -> ${replacementId}`)
      }
    }
  }
  for (const document of manifest.documents) {
    if (!manifest.layers[document.layer]) {
      issues.push(`document ${document.path} references unknown layer: ${document.layer}`)
    }
  }
  for (const [name, profile] of Object.entries(manifest.templates)) {
    if (!manifest.layers[profile.layer]) {
      issues.push(`template ${name} references unknown layer: ${profile.layer}`)
    }
  }
  return { issues, sectionIds }
}

export function resolveLayer(manifest: AgentManifest, layerName: string) {
  return applyLayer(manifest, layerName, [])
}

export function resolveDocument(manifest: AgentManifest, layerName: string, title: string) {
  return { title, sections: resolveLayer(manifest, layerName) }
}
