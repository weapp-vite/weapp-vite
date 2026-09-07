import { recordRelation } from '../trace'

const CHILD = '../child/index'
Component({
  options: { multipleSlots: true },
  data: { label: 'parent', queryResult: 'pending' },
  relations: {
    [CHILD]: {
      type: 'descendant',
      linked() { recordRelation('parent', 'linked', this.getRelationNodes(CHILD)) },
      unlinked() { recordRelation('parent', 'unlinked', this.getRelationNodes(CHILD)) },
    },
  },
  lifetimes: {
    attached() { recordRelation('parent', 'attached', this.getRelationNodes(CHILD)) },
    ready() {
      recordRelation('parent', 'ready', this.getRelationNodes(CHILD))
      this.createSelectorQuery().select('#scope-node').fields({ dataset: true }, (result) => {
        this.setData({ queryResult: result?.dataset?.scope || 'missing' })
      }).exec()
    },
    detached() { recordRelation('parent', 'detached', this.getRelationNodes(CHILD)) },
  },
})
