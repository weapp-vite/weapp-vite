import type { SafeRichTextNode } from './helpers'
import { getNativeComponentDescriptor } from '../../../shared/nativeComponents'
import { readBooleanAttribute, resolveContainingShadowRoot } from '../helpers'
import { ensureNativeComponentStyle } from '../style'
import { normalizeRichTextNodes } from './helpers'

const BaseElement = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement

function createRichTextDomNode(node: SafeRichTextNode): globalThis.Node {
  if (node.type === 'text') {
    return document.createTextNode(node.text)
  }
  const element = document.createElement(node.name)
  for (const [name, value] of Object.entries(node.attrs)) {
    element.setAttribute(name, value)
  }
  element.append(...node.children.map(createRichTextDomNode))
  return element
}

export class WeappRichText extends BaseElement {
  static observedAttributes = [...getNativeComponentDescriptor('rich-text')!.attributes]

  #content?: HTMLDivElement
  #nodes: unknown = ''

  get nodes() {
    return this.#nodes
  }

  set nodes(value: unknown) {
    if (Object.is(this.#nodes, value)) {
      return
    }
    this.#nodes = value
    this.#renderNodes()
  }

  connectedCallback() {
    ensureNativeComponentStyle(resolveContainingShadowRoot(this))
    this.#ensureStructure()
    if (this.#nodes === '') {
      this.#nodes = this.getAttribute('nodes') ?? ''
    }
    this.#syncAttributes()
    this.#renderNodes()
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null) {
    if (name === 'nodes') {
      this.#nodes = newValue ?? ''
      this.#renderNodes()
      return
    }
    this.#syncAttributes()
  }

  #ensureStructure() {
    if (this.#content || typeof document === 'undefined') {
      return
    }
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = `
      :host { overflow-wrap: break-word; }
      .content { display: block; min-width: 0; }
      img { max-width: 100%; }
    `
    const content = document.createElement('div')
    content.className = 'content'
    content.addEventListener('click', (event) => {
      const target = event.target
      if (target instanceof Element && target.closest('a')) {
        event.preventDefault()
      }
    })
    root.append(style, content)
    this.#content = content
  }

  #syncAttributes() {
    if (!this.#content) {
      return
    }
    const space = this.getAttribute('space')
    this.#content.style.whiteSpace = space === 'nbsp' || space === 'ensp' || space === 'emsp'
      ? 'pre-wrap'
      : 'normal'
    this.#content.style.userSelect = readBooleanAttribute(this, 'user-select') ? 'text' : ''
  }

  #renderNodes() {
    if (!this.#content || typeof document === 'undefined') {
      return
    }
    this.#content.replaceChildren(...normalizeRichTextNodes(this.#nodes).map(createRichTextDomNode))
  }
}

export * from './helpers'
