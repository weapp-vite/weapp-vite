import { createSharedLabel } from '../../shared/tokens'

Component({
  properties: {
    label: {
      type: String,
      value: '',
    },
  },
  data: {
    scriptMarker: createSharedLabel('COMP_SCRIPT_MARKER'),
  },
})
