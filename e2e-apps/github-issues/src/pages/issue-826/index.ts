import { sharedService } from '../../issue-fixtures/issue-826/services/shared'
import { singleService } from '../../issue-fixtures/issue-826/services/single'
import { barrelValue } from '../../issue-fixtures/issue-826/utils/barrel'
import { sharedUtil } from '../../issue-fixtures/issue-826/utils/shared'
import { singleUtil } from '../../issue-fixtures/issue-826/utils/single'

Page({
  data: {
    value: [sharedUtil(), singleUtil(), barrelValue(), sharedService(), singleService()].join('|'),
  },
})
