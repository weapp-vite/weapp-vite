import type { DomNodeExpectation, DomScope } from '../../utils/domAcceptance/types'

export function githubText(selector: string, text: string, scope: DomScope[] = []): DomNodeExpectation {
  return { selector, text, scope }
}
