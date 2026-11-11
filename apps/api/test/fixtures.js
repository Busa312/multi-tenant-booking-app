"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tbilisiDate = exports.ownerClient = void 0;
exports.asTenant = asTenant;
exports.createTenant = createTenant;
exports.dropTenant = dropTenant;
const node_crypto_1 = require("node:crypto");
const index_js_1 = require("../generated/prisma/index.js");
/**
 * The migration owner — bypasses RLS, so it can set up and tear down fixtures
 * across tenants. Never what's under test.
 */
const ownerClient = () => new index_js_1.PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
exports.ownerClient = ownerClient;
/** Runs `fn` as if inside a request for `tenantId` (what the middleware/guard would do). */
function asTenant(context, tenantId, fn) {
    return new Promise((resolve, reject) => {
        context.runWithNewContext(() => {
            context.update({ tenantId });
            fn().then(resolve, reject);
        });
    });
}
/** A bookable tenant: one 60-minute service, one professional doing it, open 09–18 every day. */
async function createTenant(owner, label) {
    const tenant = await owner.tenant.create({
        data: { name: `Test ${label}`, timezone: "Asia/Tbilisi", subdomain: `it-${label}-${(0, node_crypto_1.randomUUID)().slice(0, 8)}` },
    });
    const service = await owner.service.create({
        data: { tenantId: tenant.id, name: `Cut ${label}`, durationMinutes: 60, price: "40.00" },
    });
    const professional = await owner.professional.create({ data: { tenantId: tenant.id, name: `Pro ${label}` } });
    await owner.serviceProfessional.create({
        data: { tenantId: tenant.id, serviceId: service.id, professionalId: professional.id },
    });
    await owner.businessHours.createMany({
        data: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
            tenantId: tenant.id,
            dayOfWeek,
            startTime: new Date("1970-01-01T09:00:00.000Z"),
            endTime: new Date("1970-01-01T18:00:00.000Z"),
        })),
    });
    return { tenantId: tenant.id, serviceId: service.id, professionalId: professional.id };
}
/** Removes a fixture tenant and everything under it, children first (appointment → visit is RESTRICT). */
async function dropTenant(owner, tenantId) {
    await owner.appointmentService.deleteMany({ where: { tenantId } });
    await owner.appointment.deleteMany({ where: { tenantId } });
    await owner.visit.deleteMany({ where: { tenantId } });
    await owner.slotHold.deleteMany({ where: { tenantId } });
    await owner.tenant.delete({ where: { id: tenantId } });
}
/** YYYY-MM-DD in Tbilisi, `days` from today. */
const tbilisiDate = (days) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi" }).format(new Date(Date.now() + days * 86_400_000));
exports.tbilisiDate = tbilisiDate;
//# sourceMappingURL=fixtures.js.map