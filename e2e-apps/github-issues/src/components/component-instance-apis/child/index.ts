import { recordRelation } from '../trace'

const PARENT = '../parent/index'
Component({
  data: { label: 'child', queryResult: 'pending' },
  relations: {
    [PARENT]: {
      type: 'ancestor',
      linked() { recordRelation('child', 'linked', this.getRelationNodes(PARENT)) },
      unlinked() { recordRelation('child', 'unlinked', this.getRelationNodes(PARENT)) },
    },
  },
  lifetimes: {
    attached() { recordRelation('child', 'attached', this.getRelationNodes(PARENT)) },
    ready() {
      recordRelation('child', 'ready', this.getRelationNodes(PARENT))
      this.createSelectorQuery().select('#scope-node').fields({ dataset: true }, (result) => {
        this.setData({ queryResult: result?.dataset?.scope || 'missing' })
      }).exec()
    },
    detached() { recordRelation('child', 'detached', this.getRelationNodes(PARENT)) },
  },
})
