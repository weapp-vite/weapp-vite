#import <Foundation/Foundation.h>
#import <CoreFoundation/CoreFoundation.h>
#include <sys/types.h>
#include <sys/sysctl.h>
#include <sys/proc.h>
#include <sys/proc_info.h>
#include <libproc.h>
#include <errno.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>
#include <math.h>

static void fail(NSString *message) {
  @throw [NSException exceptionWithName:@"DarwinInspector" reason:message userInfo:nil];
}
static uint64_t nowNs(void) {
  struct timespec time;
  if (clock_gettime(CLOCK_MONOTONIC, &time) != 0) fail(@"Cannot read monotonic clock.");
  return (uint64_t)time.tv_sec * 1000000000ULL + (uint64_t)time.tv_nsec;
}
static NSString *precise(uint64_t value) {
  return [NSString stringWithFormat:@"%llu", (unsigned long long)value];
}
static void budget(uint64_t deadline) {
  if (nowNs() >= deadline) fail(@"Shared inspection deadline exhausted.");
}
static void sendInspectorResponse(NSDictionary *value) {
  NSError *error = nil;
  NSData *data = [NSJSONSerialization dataWithJSONObject:value options:0 error:&error];
  if (!data || error || fwrite(data.bytes, 1, data.length, stdout) != data.length || fputc('\n', stdout) == EOF || fflush(stdout) != 0) fail(@"Cannot write inspector response.");
}
static NSDictionary *makeIdentity(pid_t pid, pid_t parent, uid_t uid, int status, uint64_t seconds, uint64_t microseconds) {
  if (pid <= 0 || parent < 0 || status < 0 || status > 255 || microseconds > 999999ULL) fail(@"Invalid kernel identity.");
  return @{@"pid":@(pid), @"parentPid":@(parent), @"uid":@(uid), @"status":@(status), @"startedSeconds":precise(seconds), @"startedMicroseconds":precise(microseconds), @"zombie":(status == SZOMB ? @YES : @NO)};
}
static BOOL sameStableIdentity(id left, id right) {
  if (![left isKindOfClass:[NSDictionary class]] || ![right isKindOfClass:[NSDictionary class]]) return NO;
  for (NSString *key in @[@"pid", @"parentPid", @"uid", @"startedSeconds", @"startedMicroseconds", @"zombie"]) {
    if (![left[key] isEqual:right[key]]) return NO;
  }
  return YES;
}
static NSDictionary *kernelIdentity(const struct kinfo_proc *value) {
  if (value->kp_proc.p_starttime.tv_sec < 0 || value->kp_proc.p_starttime.tv_usec < 0) fail(@"Invalid kernel start time.");
  return makeIdentity(value->kp_proc.p_pid, value->kp_eproc.e_ppid, value->kp_eproc.e_ucred.cr_uid, value->kp_proc.p_stat, (uint64_t)value->kp_proc.p_starttime.tv_sec, (uint64_t)value->kp_proc.p_starttime.tv_usec);
}
static NSDictionary *readIdentity(pid_t pid) {
  struct kinfo_proc value = {0};
  size_t length = sizeof(value);
  int mib[] = {CTL_KERN, KERN_PROC, KERN_PROC_PID, pid};
  errno = 0;
  int result = sysctl(mib, 4, &value, &length, NULL, 0);
  int error = errno;
  id identity = result == 0 && length == sizeof(value) && error == 0 ? kernelIdentity(&value) : [NSNull null];
  return @{@"result":@(result), @"length":@(length), @"errno":@(error), @"identity":identity};
}
static NSDictionary *readPath(pid_t pid) {
  char value[PROC_PIDPATHINFO_MAXSIZE] = {0};
  errno = 0;
  int count = proc_pidpath(pid, value, sizeof(value));
  int error = errno;
  id image = [NSNull null];
  if (count > 0 && error == 0) {
    size_t length = strnlen(value, sizeof(value));
    if (length == sizeof(value)) fail(@"Unterminated kernel path.");
    NSString *text = [[NSString alloc] initWithBytes:value length:length encoding:NSUTF8StringEncoding];
    if (!text) fail(@"Kernel path is not valid UTF-8.");
    image = text;
  }
  return @{@"count":@(count), @"errno":@(error), @"executable":image};
}
static NSDictionary *readTask(pid_t pid) {
  struct proc_taskallinfo value = {0};
  errno = 0;
  int count = proc_pidinfo(pid, PROC_PIDTASKALLINFO, 0, &value, sizeof(value));
  int error = errno;
  id identity = [NSNull null], rss = [NSNull null];
  if (count == (int)sizeof(value) && error == 0) {
    identity = makeIdentity((pid_t)value.pbsd.pbi_pid, (pid_t)value.pbsd.pbi_ppid, value.pbsd.pbi_uid, (int)value.pbsd.pbi_status, value.pbsd.pbi_start_tvsec, value.pbsd.pbi_start_tvusec);
    rss = precise(value.ptinfo.pti_resident_size);
  }
  return @{@"count":@(count), @"errno":@(error), @"identity":identity, @"rssBytes":rss};
}
static NSDictionary *readRow(pid_t pid, uint64_t deadline) {
  budget(deadline);
  uint64_t started = nowNs();
  NSDictionary *before = readIdentity(pid);
  budget(deadline);
  NSDictionary *pathBefore = readPath(pid);
  budget(deadline);
  NSDictionary *task = readTask(pid);
  budget(deadline);
  NSDictionary *pathAfter = readPath(pid);
  budget(deadline);
  NSDictionary *after = readIdentity(pid);
  budget(deadline);
  return @{@"pid":@(pid), @"startedAtNanoseconds":precise(started), @"endedAtNanoseconds":precise(nowNs()), @"before":before, @"pathBefore":pathBefore, @"task":task, @"pathAfter":pathAfter, @"after":after};
}
static NSDictionary *frame(NSUInteger requestId, NSString *phase, uint64_t deadline) {
  uint64_t started = nowNs();
  int mib[] = {CTL_KERN, KERN_PROC, KERN_PROC_ALL, 0};
  size_t bytes = 0;
  budget(deadline);
  if (sysctl(mib, 4, NULL, &bytes, NULL, 0) != 0 || bytes == 0 || bytes > sizeof(struct kinfo_proc) * 100000ULL) fail(@"Cannot size complete process inventory.");
  size_t capacity = bytes + sizeof(struct kinfo_proc) * 64;
  struct kinfo_proc *values = calloc(1, capacity);
  if (!values) fail(@"Cannot allocate process inventory.");
  @try {
    bytes = capacity;
    budget(deadline);
    if (sysctl(mib, 4, values, &bytes, NULL, 0) != 0 || bytes > capacity || bytes % sizeof(*values) != 0) fail(@"Cannot read complete process inventory.");
    NSMutableArray *pids = [NSMutableArray array], *rows = [NSMutableArray array];
    NSMutableSet *seen = [NSMutableSet set];
    NSUInteger zeroCount = 0;
    for (size_t index = 0; index < bytes / sizeof(*values); index++) {
      pid_t pid = values[index].kp_proc.p_pid;
      if (pid == 0) { zeroCount++; continue; }
      if (pid < 0 || [seen containsObject:@(pid)]) fail(@"Invalid process enumeration.");
      [seen addObject:@(pid)];
      [pids addObject:@(pid)];
    }
    if (zeroCount > 1 || pids.count == 0 || pids.count > 100000) fail(@"Incomplete process enumeration.");
    for (NSNumber *pid in pids) [rows addObject:readRow(pid.intValue, deadline)];
    budget(deadline);
    NSDictionary *enumeration = @{@"complete":@YES, @"bytes":@(bytes), @"recordSize":@(sizeof(*values)), @"pidCount":@(pids.count), @"pids":pids, @"zeroPidCount":@(zeroCount)};
    return @{@"protocol":@1, @"requestId":@(requestId), @"phase":phase, @"startedAtNanoseconds":precise(started), @"endedAtNanoseconds":precise(nowNs()), @"enumeration":enumeration, @"rows":rows};
  } @finally {
    free(values);
  }
}
static uint64_t requestNumber(id value, uint64_t maximum) {
  if (![value isKindOfClass:[NSNumber class]] || CFGetTypeID((__bridge CFTypeRef)value) == CFBooleanGetTypeID()) fail(@"Invalid request integer.");
  double number = [value doubleValue];
  if (!isfinite(number) || number < 1 || floor(number) != number || number > maximum) fail(@"Invalid request integer.");
  return (uint64_t)number;
}
int main(void) {
  @autoreleasepool {
    @try {
      pid_t pid = getpid();
      NSDictionary *before = readIdentity(pid), *pathBefore = readPath(pid), *after = readIdentity(pid), *pathAfter = readPath(pid);
      if (!sameStableIdentity(before[@"identity"], after[@"identity"]) || pathBefore[@"executable"] == [NSNull null] || ![pathBefore[@"executable"] isEqual:pathAfter[@"executable"]]) fail(@"Cannot verify owned helper identity.");
      sendInspectorResponse(@{@"protocol":@1, @"phase":@"ready", @"pid":@(pid), @"identity":before[@"identity"], @"executable":pathBefore[@"executable"], @"abi":@{@"recordSize":@(sizeof(struct kinfo_proc)), @"taskSize":@(sizeof(struct proc_taskallinfo)), @"pathMax":@(PROC_PIDPATHINFO_MAXSIZE), @"zombieStatus":@(SZOMB)}});
      NSArray *phases = @[@"prepare", @"anchor", @"closure1", @"closure2"];
      NSUInteger completed = 0;
      uint64_t deadline = UINT64_MAX;
      char *line = NULL;
      size_t capacity = 0;
      @try {
        while (true) {
          @autoreleasepool {
            ssize_t length = getline(&line, &capacity, stdin);
            if (length < 0) {
              if (ferror(stdin) || completed < 2) fail(@"Inspector ended before prepare and anchor.");
              return 0;
            }
            if (length > 1024 * 1024 || line[length - 1] != '\n' || completed >= phases.count) fail(@"Invalid inspector request boundary.");
            NSData *data = [NSData dataWithBytes:line length:(NSUInteger)length];
            NSError *error = nil;
            id request = [NSJSONSerialization JSONObjectWithData:data options:0 error:&error];
            NSSet *keys = [NSSet setWithArray:@[@"protocol", @"requestId", @"phase", @"remainingMilliseconds"]];
            if (error || ![request isKindOfClass:[NSDictionary class]] || ![[NSSet setWithArray:[request allKeys]] isEqual:keys]) fail(@"Invalid inspector request shape.");
            if (requestNumber(request[@"protocol"], 1) != 1 || requestNumber(request[@"requestId"], 4) != completed + 1 || ![request[@"phase"] isEqual:phases[completed]]) fail(@"Invalid inspector phase order.");
            uint64_t remaining = requestNumber(request[@"remainingMilliseconds"], 10000);
            uint64_t proposed = nowNs() + remaining * 1000000ULL;
            if (proposed < deadline) deadline = proposed;
            budget(deadline);
            sendInspectorResponse(frame(completed + 1, phases[completed], deadline));
            completed++;
          }
        }
      } @finally {
        free(line);
      }
    } @catch (NSException *exception) {
      fprintf(stderr, "Darwin inspector: %s\n", exception.reason.UTF8String ?: "unknown failure");
      return 1;
    }
  }
}
