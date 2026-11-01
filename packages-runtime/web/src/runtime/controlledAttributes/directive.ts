import type { ElementPart, PartInfo } from 'lit/async-directive.js'
import type { ControlledReader, ControlledScope } from './dependencies'
import { noChange } from 'lit'
import { AsyncDirective, directive, PartType } from 'lit/async-directive.js'
import { commitControlledBinding, createControlledBinding, releaseControlledBinding } from './state'

class ControlledAttributeDirective extends AsyncDirective {
  #binding?: ReturnType<typeof createControlledBinding>
  #read?: ControlledReader
  #scope?: ControlledScope

  constructor(part: PartInfo) {
    super(part)
    if (part.type !== PartType.ELEMENT) {
      throw new TypeError('Controlled attributes require an element binding.')
    }
  }

  render(_context: object, _name: string, _read: ControlledReader, _scope: ControlledScope) {
    return noChange
  }

  update(part: ElementPart, [context, name, read, scope]: Parameters<this['render']>) {
    if (this.#binding && (this.#binding.context !== context || this.#binding.element !== part.element || this.#binding.name !== name)) {
      releaseControlledBinding(this.#binding)
      this.#binding = undefined
    }
    this.#binding ??= createControlledBinding(context, part.element, name)
    this.#read = read
    this.#scope = scope
    commitControlledBinding(this.#binding, read, scope)
    return noChange
  }

  protected disconnected() {
    if (this.#binding) {
      releaseControlledBinding(this.#binding)
    }
  }

  protected reconnected() {
    const previous = this.#binding
    if (previous && this.#read && this.#scope) {
      this.#binding = createControlledBinding(previous.context, previous.element, previous.name)
      commitControlledBinding(this.#binding, this.#read, this.#scope)
    }
  }
}

export const bindControlledAttribute = directive(ControlledAttributeDirective)
