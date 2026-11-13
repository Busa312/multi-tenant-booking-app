import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import type { CmsDashboardQuery, DashboardDay, DashboardSummary } from "@booking/shared-types";
import type { Prisma } from "../../generated/prisma/index.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantContextService } from "../tenant/tenant-context.service.js";
import { APPOINTMENT_SUMMARY_INCLUDE } from "../common/serializers.js";
import { summarizeAppointments } from "../common/appointment-summaries.js";
import { addDaysToDateString, dayOfWeekForDateString, zonedDateString, zonedTimeToUtc } from "../common/timezone.js";
import { summarizeDay, summarizePeriod } from "./dashboard-metrics.js";

/** How many unmarked appointments the home page lists; the count covers the rest. */
export const DASHBOARD_UNMARKED_LIMIT = 8;
/** R360: how many upcoming bookings from customers with a missed visit it lists. */
export const DASHBOARD_AT_RISK_LIMIT = 8;
export const DASHBOARD_PERIOD_DAYS = 30;
export const DASHBOARD_WEEK_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// R370: the numbers on the CMS home page
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async summary(query: CmsDashboardQuery, now: Date = new Date()): Promise<DashboardSummary> {
    const { tenantId, role, professionalId } = this.tenantContext.current;
    if (role === "professional" && !professionalId) {
      throw new ForbiddenException("this login isn't linked to a professional record");
    }
    // R20: a professional sees only their own appointments
    const professionalScope = role === "professional" ? professionalId : null;
    const locationId = query.locationId?.trim() || null;
    if (locationId !== null && !UUID.test(locationId)) {
      throw new BadRequestException("locationId must be a location id");
    }

    return this.prisma.forTenant(async (tx) => {
      const { timezone } = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { timezone: true } });

      // R150: the location tab narrows appointments to that branch
      const scope: Prisma.AppointmentWhereInput = {
        tenantId,
        ...(professionalScope ? { professionalId: professionalScope } : {}),
        ...(locationId ? { locationId } : {}),
      };
      const unmarkedWhere: Prisma.AppointmentWhereInput = { ...scope, status: "booked", endAt: { lte: now } };

      const today = zonedDateString(now, timezone);
      const weekStart = zonedTimeToUtc(today, 0, timezone);
      const weekEnd = zonedTimeToUtc(addDaysToDateString(today, DASHBOARD_WEEK_DAYS), 0, timezone);
      const currentStart = new Date(now.getTime() - DASHBOARD_PERIOD_DAYS * DAY_MS);
      const previousStart = new Date(now.getTime() - 2 * DASHBOARD_PERIOD_DAYS * DAY_MS);

      const [unmarked, unmarkedCount, upcoming, periodRows, weekRows, professionals, businessHours, timeOff] = await Promise.all([
        tx.appointment.findMany({
          where: unmarkedWhere,
          include: APPOINTMENT_SUMMARY_INCLUDE,
          orderBy: { startAt: "asc" },
          take: DASHBOARD_UNMARKED_LIMIT,
        }),
        tx.appointment.count({ where: unmarkedWhere }),
        // R360: what's still to come this week — narrowed below to customers with a missed visit
        tx.appointment.findMany({
          where: { ...scope, status: "booked", startAt: { gte: now, lt: weekEnd } },
          include: APPOINTMENT_SUMMARY_INCLUDE,
          orderBy: { startAt: "asc" },
        }),
        tx.appointment.findMany({
          where: { ...scope, startAt: { gte: previousStart, lt: now } },
          select: { id: true, visitId: true, phoneKey: true, status: true, createdByUserId: true, price: true, startAt: true },
        }),
        tx.appointment.findMany({
          where: { ...scope, status: { not: "cancelled" }, startAt: { gte: weekStart, lt: weekEnd } },
          select: { id: true, visitId: true, professionalId: true, startAt: true, endAt: true },
        }),
        professionalScope
          ? Promise.resolve([{ id: professionalScope }])
          : tx.professional.findMany({
              where: {
                tenantId,
                isActive: true,
                // R180: a professional with no location works at every location
                ...(locationId ? { OR: [{ locationId }, { locationId: null }] } : {}),
              },
              select: { id: true },
            }),
        tx.businessHours.findMany({
          where: { tenantId },
          select: { professionalId: true, dayOfWeek: true, startTime: true, endTime: true },
        }),
        tx.timeOff.findMany({
          where: { tenantId, startAt: { lt: weekEnd }, endAt: { gt: weekStart } },
          select: { professionalId: true, startAt: true, endAt: true },
        }),
      ]);

      // First visit ever per phone, across every branch: "new" means new to
      // the salon (or, for a professional login, new to them), not to a branch.
      const phones = [...new Set(periodRows.filter((row) => row.status !== "cancelled").map((row) => row.phoneKey))];
      const firsts =
        phones.length === 0
          ? []
          : await tx.appointment.groupBy({
              by: ["phoneKey"],
              where: {
                tenantId,
                ...(professionalScope ? { professionalId: professionalScope } : {}),
                status: { not: "cancelled" },
                phoneKey: { in: phones },
              },
              _min: { startAt: true },
            });
      const firstSeen = new Map<string, Date>();
      for (const row of firsts) {
        if (row._min.startAt) firstSeen.set(row.phoneKey, row._min.startAt);
      }

      // Money is the owner's: a professional login never receives a value
      const includeValue = professionalScope === null;
      const professionalIds = professionals.map((professional) => professional.id);

      const week: DashboardDay[] = [];
      for (let offset = 0; offset < DASHBOARD_WEEK_DAYS; offset += 1) {
        const date = addDaysToDateString(today, offset);
        const dayStart = zonedTimeToUtc(date, 0, timezone);
        const dayEnd = zonedTimeToUtc(addDaysToDateString(date, 1), 0, timezone);
        const dayOfWeek = dayOfWeekForDateString(date);
        week.push(
          summarizeDay({
            date,
            timezone,
            appointments: weekRows.filter((row) => row.startAt >= dayStart && row.startAt < dayEnd),
            professionalIds,
            businessHours: businessHours.filter((row) => row.dayOfWeek === dayOfWeek),
            timeOff: timeOff.filter((block) => block.startAt < dayEnd && block.endAt > dayStart),
          }),
        );
      }

      // R360: one lookup of the customers' records covers both lists
      const summaries = await summarizeAppointments(tx, tenantId, [...unmarked, ...upcoming]);
      const atRisk = summaries.slice(unmarked.length).filter((appointment) => (appointment.noShowHistory?.missed ?? 0) > 0);

      return {
        unmarked: summaries.slice(0, unmarked.length),
        unmarkedCount,
        atRisk: atRisk.slice(0, DASHBOARD_AT_RISK_LIMIT),
        atRiskCount: atRisk.length,
        week,
        current: summarizePeriod(
          periodRows.filter((row) => row.startAt >= currentStart),
          firstSeen,
          currentStart,
          includeValue,
        ),
        previous: summarizePeriod(
          periodRows.filter((row) => row.startAt < currentStart),
          firstSeen,
          previousStart,
          includeValue,
        ),
      };
    });
  }
}
