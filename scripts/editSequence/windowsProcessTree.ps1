param([uint32]$RootProcessId, [switch]$Warm)

$ErrorActionPreference = 'Stop'
$diagnosticStopwatch = [Diagnostics.Stopwatch]::StartNew()
[Console]::Error.WriteLine("process-tree:script-enter elapsedMs=$($diagnosticStopwatch.ElapsedMilliseconds)")

$assemblyPath = Join-Path ([IO.Path]::GetTempPath()) 'weapp-vite-edit-sequence-process-tree-v3.dll'

# 直接读取内核进程快照，避免 WMI/CIM provider 的冷启动进入采样路径。
if (Test-Path -LiteralPath $assemblyPath) {
  [Console]::Error.WriteLine("process-tree:helper-cache-hit elapsedMs=$($diagnosticStopwatch.ElapsedMilliseconds)")
  Add-Type -Path $assemblyPath
}
else {
  [Console]::Error.WriteLine("process-tree:helper-compile elapsedMs=$($diagnosticStopwatch.ElapsedMilliseconds)")
  $temporaryAssemblyPath = "$assemblyPath.$PID.tmp"
  Add-Type -ReferencedAssemblies System.Core.dll -OutputAssembly $temporaryAssemblyPath -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;

public static class EditSequenceProcessTree {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  private struct ProcessEntry {
    public uint Size;
    public uint Usage;
    public uint ProcessId;
    public UIntPtr DefaultHeapId;
    public uint ModuleId;
    public uint Threads;
    public uint ParentProcessId;
    public int PriorityClassBase;
    public uint Flags;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
    public string ExeFile;
  }

  public sealed class Observation {
    public uint ProcessId;
    public uint ParentProcessId;
    public long WorkingSetSize;
  }

  // 固定协议只含三个整数，避免通用 PowerShell 对象序列化进入有期限的采样路径。
  public static string ToJson(Observation[] observations) {
    var json = new StringBuilder("[");
    for (var index = 0; index < observations.Length; index++) {
      if (index > 0) {
        json.Append(',');
      }
      var row = observations[index];
      json.Append("{\"ProcessId\":").Append(row.ProcessId.ToString(CultureInfo.InvariantCulture));
      json.Append(",\"ParentProcessId\":").Append(row.ParentProcessId.ToString(CultureInfo.InvariantCulture));
      json.Append(",\"WorkingSetSize\":").Append(row.WorkingSetSize.ToString(CultureInfo.InvariantCulture));
      json.Append('}');
    }
    return json.Append(']').ToString();
  }

  public static string ReadJson(uint rootProcessId, Stopwatch stopwatch) {
    var observations = Read(rootProcessId);
    Console.Error.WriteLine("process-tree:query-complete elapsedMs=" + stopwatch.ElapsedMilliseconds.ToString(CultureInfo.InvariantCulture));
    return ToJson(observations.ToArray());
  }

  [DllImport("kernel32.dll", SetLastError = true)]
  private static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint processId);
  [DllImport("kernel32.dll", EntryPoint = "Process32FirstW", SetLastError = true, CharSet = CharSet.Unicode)]
  private static extern bool Process32First(IntPtr snapshot, ref ProcessEntry entry);
  [DllImport("kernel32.dll", EntryPoint = "Process32NextW", SetLastError = true, CharSet = CharSet.Unicode)]
  private static extern bool Process32Next(IntPtr snapshot, ref ProcessEntry entry);
  [DllImport("kernel32.dll", SetLastError = true)]
  private static extern bool CloseHandle(IntPtr handle);

  public static List<Observation> Read(uint rootProcessId) {
    var rows = new List<Observation>();
    var snapshot = CreateToolhelp32Snapshot(2, 0);
    if (snapshot == new IntPtr(-1)) {
      throw new Win32Exception(Marshal.GetLastWin32Error());
    }
    try {
      var entry = new ProcessEntry();
      entry.Size = (uint)Marshal.SizeOf(typeof(ProcessEntry));
      var available = Process32First(snapshot, ref entry);
      while (available) {
        rows.Add(new Observation { ProcessId = entry.ProcessId, ParentProcessId = entry.ParentProcessId });
        available = Process32Next(snapshot, ref entry);
      }
      var error = Marshal.GetLastWin32Error();
      if (error != 18) {
        throw new Win32Exception(error);
      }
    }
    finally {
      CloseHandle(snapshot);
    }

    var owned = new HashSet<uint> { rootProcessId };
    bool changed;
    do {
      changed = false;
      foreach (var row in rows) {
        if (owned.Contains(row.ParentProcessId) && owned.Add(row.ProcessId)) {
          changed = true;
        }
      }
    } while (changed);

    var result = new List<Observation>();
    foreach (var row in rows) {
      if (!owned.Contains(row.ProcessId)) {
        continue;
      }
      // 使用 64 位字节值，且只打开已登记根进程及其后代的查询句柄。
      using (var process = Process.GetProcessById((int)row.ProcessId)) {
        row.WorkingSetSize = process.WorkingSet64;
      }
      result.Add(row);
    }
    return result;
  }
}
'@
  try {
    Move-Item -LiteralPath $temporaryAssemblyPath -Destination $assemblyPath -Force
  }
  catch {
    # 另一个并发采样进程可能已经发布了同一版本的缓存；当前进程已加载自己的临时 assembly。
    if (-not (Test-Path -LiteralPath $assemblyPath)) {
      throw
    }
    Remove-Item -LiteralPath $temporaryAssemblyPath -Force -ErrorAction SilentlyContinue
  }
}

[Console]::Error.WriteLine("process-tree:helper-ready elapsedMs=$($diagnosticStopwatch.ElapsedMilliseconds)")
if ($Warm) {
  return
}

$json = [EditSequenceProcessTree]::ReadJson($RootProcessId, $diagnosticStopwatch)
[Console]::Error.WriteLine("process-tree:json-serialized elapsedMs=$($diagnosticStopwatch.ElapsedMilliseconds)")
[Console]::Out.WriteLine($json)
[Console]::Error.WriteLine("process-tree:json-output-written elapsedMs=$($diagnosticStopwatch.ElapsedMilliseconds)")
