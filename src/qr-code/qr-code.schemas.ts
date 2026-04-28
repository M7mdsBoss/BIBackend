import { z } from 'zod';

export const createVisitSchema = z.object({
  residentFullName: z.string().min(2).max(150),
  residentUnit: z.string().min(1).max(50),
  residentPhone: z.string().min(7).max(30),
  visitorFullName: z.string().min(2).max(150),
  visitorId: z.string().min(1).max(50),
  visitDate: z.string().datetime({ offset: true }).or(z.string().date()),
  visitTime: z.string().regex(/^\d{2}:\d{2}$/, 'visitTime must be HH:MM'),
  compound: z.string().min(1).max(150).optional(),
});
