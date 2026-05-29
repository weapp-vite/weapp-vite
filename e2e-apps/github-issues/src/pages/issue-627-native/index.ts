Page({
  data: {
    matrix: [] as Array<{
      key: string
      native: string
      result: string
      sfc: string
    }>,
    summary: '',
    title: 'issue-627 native reserved props',
  },
  onReady() {
    this.refreshMatrix()
  },
  _runE2E() {
    const probe = this.selectComponent?.('#issue627-native-probe') as any
    const sfcLiteral = this.selectComponent?.('#issue627-sfc-host-literal') as any
    const sfcDynamic = this.selectComponent?.('#issue627-sfc-host-dynamic') as any
    return {
      native: typeof probe?.snapshot === 'function' ? probe.snapshot() : null,
      sfcLiteral: typeof sfcLiteral?._runE2E === 'function' ? sfcLiteral._runE2E() : null,
      sfcDynamic: typeof sfcDynamic?._runE2E === 'function' ? sfcDynamic._runE2E() : null,
    }
  },
  refreshMatrix() {
    const snapshot = this._runE2E()
    const rows = [
      ['id', '', ''],
      ['class', '', ''],
      ['slot', '', ''],
      ['style', 'color: rgb(22, 119, 255);', 'color: rgb(22, 119, 255);'],
      ['hidden', false, false],
      ['dataFoo', 'issue-627-native-dataFoo', 'issue-627-sfc-host-dataFoo'],
      ['data-foo', 'issue-627-native-data-foo', 'n/a'],
      ['markFoo', 'issue-627-native-markFoo', 'issue-627-sfc-host-markFoo'],
      ['mark:foo', 'issue-627-native-mark-colon-foo', 'n/a'],
      ['customClass', 'issue-627-native-custom-class', 'issue-627-sfc-host-custom-class'],
      ['customStyle', 'font-size: 32rpx;', 'font-size: 32rpx;'],
      ['customHidden', true, true],
      ['customDataFoo', 'issue-627-native-custom-data-foo', 'issue-627-sfc-host-custom-data-foo'],
    ] as const
    const matrix = rows.map(([key, nativeExpected, sfcExpected]) => {
      const nativeKey = key === 'data-foo'
        ? 'dataDashFoo'
        : key === 'mark:foo'
          ? 'markColonFoo'
          : key
      const native = snapshot.native?.[nativeKey] ?? ''
      const sfc = sfcExpected === 'n/a' ? 'n/a' : snapshot.sfcLiteral?.[key] ?? ''
      const pass = native === nativeExpected && (sfcExpected === 'n/a' || sfc === sfcExpected)
      return {
        key,
        native: String(native),
        result: pass ? 'PASS' : 'FAIL',
        sfc: String(sfc),
      }
    })

    this.setData({
      matrix,
      summary: matrix.every(row => row.result === 'PASS')
        ? 'PASS: id/class/slot are empty; readable props keep their values.'
        : 'FAIL: check matrix rows below.',
    })
  },
})
