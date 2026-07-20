/* eslint-disable no-undef, prefer-arrow-callback, style/space-before-function-paren -- hap-toolkit E2E 使用 Mocha 全局和普通函数。 */
export default function(vm) {
  describe('native list', function() {
    it('keeps the native oracle data', function() {
      expect(vm.items.map(item => item.name)).to.deep.equal(['alpha', 'beta'])
    })
  })
}
