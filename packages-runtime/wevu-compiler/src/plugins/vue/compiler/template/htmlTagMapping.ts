import type { TransformContext } from './types'

export const DEFAULT_HTML_TO_WXML_TAG_MAP: Record<string, string> = {
  a: 'navigator',
  article: 'view',
  aside: 'view',
  b: 'text',
  blockquote: 'view',
  button: 'button',
  code: 'text',
  dd: 'view',
  div: 'view',
  dl: 'view',
  dt: 'view',
  em: 'text',
  figcaption: 'view',
  figure: 'view',
  footer: 'view',
  form: 'form',
  h1: 'view',
  h2: 'view',
  h3: 'view',
  h4: 'view',
  h5: 'view',
  h6: 'view',
  header: 'view',
  i: 'text',
  img: 'image',
  input: 'input',
  label: 'label',
  li: 'view',
  main: 'view',
  nav: 'view',
  ol: 'view',
  p: 'view',
  pre: 'view',
  section: 'view',
  small: 'text',
  span: 'text',
  strong: 'text',
  textarea: 'textarea',
  u: 'text',
  ul: 'view',
}

export function resolveHtmlTagToWxmlMap(
  value: boolean | Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (value === false) {
    return undefined
  }

  if (value === true || value === undefined) {
    return { ...DEFAULT_HTML_TO_WXML_TAG_MAP }
  }

  return {
    ...DEFAULT_HTML_TO_WXML_TAG_MAP,
    ...Object.fromEntries(
      Object.entries(value).map(([key, mapped]) => [key.toLowerCase(), mapped]),
    ),
  }
}

export function resolveTemplateTagName(tag: string, context: Pick<TransformContext, 'htmlTagToWxmlMap'>): string {
  if (!tag) {
    return tag
  }

  const lowerTag = tag.toLowerCase()
  if (tag !== lowerTag) {
    return tag
  }

  return context.htmlTagToWxmlMap?.[lowerTag] ?? tag
}
