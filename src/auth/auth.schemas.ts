import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  phone: z.string().max(30).optional(),
  website: z.string().optional().or(z.literal('')),
  chatVolume: z.string().max(10).optional(),
  campany: z.string().max(150).optional(),
  industry: z.string().max(100).optional(),
  campanySize: z.string().max(10).optional(),
});

export const confirmRegisterSchema = z.object({
  token: z.string().min(1),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
