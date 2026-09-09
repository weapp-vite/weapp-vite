import { DomUtils, parseDocument } from 'htmlparser2'

export function findMarkupElements(source: string, tagName: string) {
  const document = parseDocument(source, {
    xmlMode: true,
    decodeEntities: false,
    lowerCaseAttributeNames: false,
    lowerCaseTags: false,
  })
  return DomUtils.getElementsByTagName(tagName, document.children)
}
