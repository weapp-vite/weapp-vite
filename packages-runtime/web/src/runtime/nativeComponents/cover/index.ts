import { getNativeComponentDescriptor } from '../../../shared/nativeComponents'
import { WeappImage } from '../image'
import { WeappView } from '../primitives'

export class WeappCoverView extends WeappView {
  connectedCallback() {
    super.connectedCallback()
    this.style.zIndex = '2'
  }
}

export class WeappCoverImage extends WeappImage {
  static observedAttributes = [...getNativeComponentDescriptor('cover-image')!.attributes]

  connectedCallback() {
    super.connectedCallback()
    this.style.position = 'absolute'
    this.style.zIndex = '2'
  }
}
