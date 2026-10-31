import { TEMPLATE_DEFINITIONS } from '../src/templates'

export const Templates = TEMPLATE_DEFINITIONS.map(template => ({
  target: template.directory,
  dest: template.id,
}))
