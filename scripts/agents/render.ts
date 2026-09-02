import type { AgentManifest, ResolvedAgentDocument } from './types'

export const AGENTS_GENERATED_MARKER = '<!-- agents-generated: v1 -->'

export function renderAgentDocument(
  manifest: AgentManifest,
  document: ResolvedAgentDocument,
  sourceName: string,
) {
  const sections = document.sections
    .map(section => section.content.replace(/\r\n?/g, '\n').trim())
    .filter(Boolean)
  return [
    `# ${document.title}`,
    '',
    AGENTS_GENERATED_MARKER,
    `<!-- source: ${sourceName}; manifest-version: ${manifest.version}; generator-version: ${manifest.generatorVersion} -->`,
    '',
    ...sections.flatMap(section => [section, '']),
  ].join('\n').replace(/\n{3,}$/g, '\n\n')
}

export function renderTemplateMap(manifest: AgentManifest) {
  return Object.fromEntries(
    Object.entries(manifest.templates).map(([name, profile]) => [
      name,
      renderAgentDocument(
        manifest,
        { title: profile.title, sections: [] },
        `template:${name}`,
      ),
    ]),
  )
}
