// JXA 只使用 Foundation/libSystem；冷启动后接收一次 PID 请求，不创建嵌套子进程。
export const darwinSnapshotScript = `
ObjC.import('Foundation');
ObjC.bindFunction('malloc', ['void *', ['unsigned long']]);
ObjC.bindFunction('free', ['void', ['void *']]);
ObjC.bindFunction('proc_pidpath', ['int', ['int', 'void *', 'uint32_t']]);
ObjC.bindFunction('strchr', ['char *', ['void *', 'int']]);
function run() {
  var input = $.NSFileHandle.fileHandleWithStandardInput;
  var output = $.NSFileHandle.fileHandleWithStandardOutput;
  function send(value) {
    output.writeData($(JSON.stringify(value) + '\\n').dataUsingEncoding($.NSUTF8StringEncoding));
  }
  send({ phase: 'ready' });
  var request = '';
  while (request.indexOf('\\n') < 0) {
    var chunk = input.availableData;
    if (!Number(chunk.length)) throw new Error('Missing process identity request.');
    request += ObjC.unwrap($.NSString.alloc.initWithDataEncoding(chunk, $.NSUTF8StringEncoding));
    if (request.length > 1024 * 1024) throw new Error('Oversized process identity request.');
  }
  if (request.indexOf('\\n') !== request.length - 1) throw new Error('Multiple process identity requests.');
  var parsed = JSON.parse(request);
  if (!parsed || Object.keys(parsed).length !== 1 || !Array.isArray(parsed.pids)) throw new Error('Invalid process identity request.');
  var seen = {};
  var pids = parsed.pids;
  pids.forEach(function(pid) {
    if (!Number.isSafeInteger(pid) || pid <= 0 || seen[pid]) throw new Error('Invalid process identity.');
    seen[pid] = true;
  });
  var buffer = $.malloc(4096);
  if (!buffer) throw new Error('Cannot allocate process path buffer.');
  try {
    send({ phase: 'paths', paths: pids.map(function(pid) {
      var count = $.proc_pidpath(pid, buffer, 4096);
      return { pid: pid, executable: count > 0 ? $.strchr(buffer, 47) : null };
    }) });
    // Node 完成后验 ps 后才关闭 stdin，避免 helper 自身在两帧之间消失。
    if (Number(input.readDataToEndOfFile.length)) throw new Error('Unexpected trailing inspector input.');
  } finally { $.free(buffer); }
}
`
