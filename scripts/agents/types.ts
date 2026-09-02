export interface AgentSection {
  id: string
  contentFile: string
}

export interface AgentLayer {
  base?: string
  include?: string[]
  replace?: Record<string, string>
  remove?: string[]
}

export interface AgentDocument {
  path: string
  title: string
  layer: string
}

export interface AgentTemplateProfile {
  title: string
  layer: string
}

export interface AgentManifest {
  version: number
  generatorVersion: string
  sections: Record<string, AgentSection>
  layers: Record<string, AgentLayer>
  documents: AgentDocument[]
  templates: Record<string, AgentTemplateProfile>
}

export interface ResolvedAgentSection {
  id: string
  content: string
}

export interface ResolvedAgentDocument {
  title: string
  sections: ResolvedAgentSection[]
}
