/* eslint-disable no-undef, prefer-arrow-callback, style/space-before-function-paren -- hap-toolkit E2E 使用 Mocha 全局和普通函数。 */
export default function(vm) {
  describe('vue system api', function() {
    it('updates a ref from the declared system API', function() {
      expect(vm.result).to.equal('idle')
      vm.readDevice()
      expect(vm.result).to.equal('supported')
    })
  })
}
