const locks = new Set<string>();
let previousOverflow = '';

export function setModalScrollLock(key: string, active: boolean): void {
  if (active) {
    if (!locks.size) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    locks.add(key);
    return;
  }
  locks.delete(key);
  if (!locks.size) document.body.style.overflow = previousOverflow;
}
