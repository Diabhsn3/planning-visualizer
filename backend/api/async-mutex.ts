/**
 * Tiny in-process async mutex.
 *
 * Serializes critical sections that do read-modify-write on a shared file
 * (e.g. the JSON stores in saved-domains.ts / basic-renderer-cache.ts), so
 * two concurrent requests in the same Node process cannot interleave a
 * load -> mutate -> save and lose each other's update / collide on ids.
 *
 * Scope: a single process. The deployment must run one backend process
 * (no `pm2 -i` / node cluster), which is already the case.
 */
export function createMutex() {
  let tail: Promise<unknown> = Promise.resolve();
  return function run<T>(fn: () => Promise<T>): Promise<T> {
    const result = tail.then(fn, fn);
    // Keep the chain alive even if `fn` rejects, but don't leak the rejection.
    tail = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  };
}
