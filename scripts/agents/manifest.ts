import type { AgentManifest } from './types'
import path from 'node:path'

const content = (name: string) => path.join('scripts/agents/content', name)
const templateNames = [
  'default',
  'multi-platform',
  'multi-platform-sfc',
  'plugin',
  'wevu',
  'tailwindcss',
  'vant',
  'tdesign',
  'wevu-tdesign',
  'react',
  'lib',
]

export const agentManifest: AgentManifest = {
  version: 1,
  generatorVersion: '1',
  sections: {
    'shared.docs-first': { id: 'shared.docs-first', contentFile: content('shared-docs-first.md') },
    'shared.local-overlay': { id: 'shared.local-overlay', contentFile: content('shared-local-overlay.md') },
    'root.intro': { id: 'root.intro', contentFile: content('root-intro.md') },
    'root.routing': { id: 'root.routing', contentFile: content('root-01-1-monorepo-routing.md') },
    'root.fast-path': { id: 'root.fast-path', contentFile: content('root-02-2-fast-path-commands-prefer-smallest-verificatio.md') },
    'root.coding': { id: 'root.coding', contentFile: content('root-03-3-coding-rules.md') },
    'root.testing': { id: 'root.testing', contentFile: content('root-04-4-test-and-e2e-requirements.md') },
    'root.delivery': { id: 'root.delivery', contentFile: content('root-05-5-commit-and-changeset-rules.md') },
    'root.security': { id: 'root.security', contentFile: content('root-06-6-security-and-environment.md') },
    'root.skills': { id: 'root.skills', contentFile: content('root-07-7-project-skills-codex-claude-code.md') },
    'dashboard.intro': { id: 'dashboard.intro', contentFile: content('dashboard-intro.md') },
    'dashboard.checks': { id: 'dashboard.checks', contentFile: content('dashboard-01-required-checks.md') },
    'dashboard.vue-config': { id: 'dashboard.vue-config', contentFile: content('dashboard-02-vue-type-configuration-guard.md') },
    'dashboard.ui-validation': { id: 'dashboard.ui-validation', contentFile: content('dashboard-03-real-ui-validation.md') },
    'dashboard-ui-lab.intro': { id: 'dashboard-ui-lab.intro', contentFile: content('dashboard-ui-lab-intro.md') },
    'dashboard-ui-lab.workflow': { id: 'dashboard-ui-lab.workflow', contentFile: content('dashboard-ui-lab-01-required-workflow.md') },
    'dashboard-ui-lab.validation': { id: 'dashboard-ui-lab.validation', contentFile: content('dashboard-ui-lab-02-validation-notes.md') },
    'weapp-vite.intro': { id: 'weapp-vite.intro', contentFile: content('weapp-vite-intro.md') },
    'weapp-vite.paths': { id: 'weapp-vite.paths', contentFile: content('weapp-vite-01-1-high-value-paths.md') },
    'weapp-vite.tests': { id: 'weapp-vite.tests', contentFile: content('weapp-vite-02-2-fast-test-matrix.md') },
    'weapp-vite.invariants': { id: 'weapp-vite.invariants', contentFile: content('weapp-vite-03-3-compiler-output-invariants.md') },
    'weapp-vite.guardrails': { id: 'weapp-vite.guardrails', contentFile: content('weapp-vite-04-4-editing-guardrails.md') },
    'weapp-vite.runtime': { id: 'weapp-vite.runtime', contentFile: content('weapp-vite-05-5-mini-program-runtime-debug-heuristics.md') },
  },
  layers: {
    'shared': {
      include: ['shared.docs-first', 'shared.local-overlay'],
    },
    'root': {
      base: 'shared',
      include: ['root.intro', 'root.routing', 'root.fast-path', 'root.coding', 'root.testing', 'root.delivery', 'root.security', 'root.skills'],
    },
    'dashboard': {
      base: 'shared',
      include: ['dashboard.intro', 'dashboard.checks', 'dashboard.vue-config', 'dashboard.ui-validation'],
    },
    'dashboard-ui-lab': {
      base: 'shared',
      include: ['dashboard-ui-lab.intro', 'dashboard-ui-lab.workflow', 'dashboard-ui-lab.validation'],
    },
    'weapp-vite': {
      base: 'shared',
      include: ['weapp-vite.intro', 'weapp-vite.paths', 'weapp-vite.tests', 'weapp-vite.invariants', 'weapp-vite.guardrails', 'weapp-vite.runtime'],
    },
  },
  documents: [
    { path: 'AGENTS.md', title: 'AGENTS Guidelines (Global Baseline)', layer: 'root' },
    { path: 'packages/dashboard/AGENTS.md', title: 'AGENTS Guidelines for @weapp-vite/dashboard', layer: 'dashboard' },
    { path: 'apps/dashboard-ui-lab/AGENTS.md', title: 'AGENTS Guidelines for dashboard-ui-lab', layer: 'dashboard-ui-lab' },
    { path: 'packages/weapp-vite/AGENTS.md', title: 'AGENTS Guidelines (packages/weapp-vite)', layer: 'weapp-vite' },
  ],
  templates: Object.fromEntries(templateNames.map(name => [name, {
    title: 'AGENTS Guidelines',
    layer: `template:${name}`,
  }])),
}

for (const name of Object.keys(agentManifest.templates)) {
  const sectionId = `template.${name}`
  agentManifest.sections[sectionId] = {
    id: sectionId,
    contentFile: content(`template-${name}.md`),
  }
  agentManifest.layers[`template:${name}`] = {
    include: [sectionId],
  }
}

export const AGENTS_MANIFEST_PATH = path.resolve(import.meta.dirname, 'manifest.ts')
