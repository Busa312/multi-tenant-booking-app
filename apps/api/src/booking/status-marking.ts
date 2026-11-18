import { BadRequestException } from "@nestjs/common";

/**
 * R530: completed and no-show describe something that happened, so they can't
 * be set before the appointment starts — an early "no-show" would count
 * against the customer's history (R360). Putting a booking back to "booked"
 * is always allowed (it's how a mistaken mark is undone).
 */
export function canMark(status: string, startAt: Date, now: Date = new Date()): boolean {
  return status === "booked" || startAt.getTime() <= now.getTime();
}

export function assertMarkable(status: string, startAt: Date, now: Date = new Date()): void {
  if (!canMark(status, startAt, now)) {
    throw new BadRequestException({
      code: "not_started",
      message: "A booking can be marked completed or no-show only once it has started.",
    });
  }
}
