// Only a confirmed absence from the face detector can unlock the next scan.
// Unknown/dropped frames must never count as someone leaving the camera.
export class AttendanceScanGate {
  private absentSince: number | null = null;
  private readyAt = 0;
  waiting = false;

  reset() {
    this.waiting = false;
    this.absentSince = null;
  }

  waitForDeparture(now: number) {
    this.waiting = true;
    this.absentSince = null;
    this.readyAt = now + 3500;
  }

  observe(presence: "present" | "absent" | undefined, now: number): boolean {
    if (!this.waiting) return true;
    if (presence !== "absent") {
      this.absentSince = null;
      return false;
    }
    this.absentSince ??= now;
    if (now < this.readyAt || now - this.absentSince < 600) return false;
    this.reset();
    return true;
  }
}
