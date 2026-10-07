// Invalidates delayed work when a camera popup closes or opens a new session.
export class AsyncSession {
  private revision = 0;
  private timers = new Set<ReturnType<typeof setTimeout>>();

  get current() { return this.revision; }
  isCurrent(revision: number) { return revision === this.revision; }

  cancel() {
    this.revision += 1;
    this.timers.forEach(clearTimeout);
    this.timers.clear();
  }

  schedule(callback: () => void, delay: number) {
    const revision = this.revision;
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (this.isCurrent(revision)) callback();
    }, delay);
    this.timers.add(timer);
    return timer;
  }
}

export async function openSessionCamera(session: AsyncSession, constraints: MediaStreamConstraints) {
  const revision = session.current;
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  if (!session.isCurrent(revision)) {
    stream.getTracks().forEach((track) => track.stop());
    return null;
  }
  return stream;
}
