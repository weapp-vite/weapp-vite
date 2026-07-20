/* eslint-disable no-undef, prefer-arrow-callback, style/space-before-function-paren -- hap-toolkit E2E 使用 Mocha 全局和普通函数。 */
export default function(vm) {
  describe('vue component event', function() {
    it('updates parent state from the QuickApp event detail', function() {
      expect(vm.count).to.equal(1)
      vm.setCount({ detail: 2 })
      expect(vm.count).to.equal(2)
    })
  })
}
