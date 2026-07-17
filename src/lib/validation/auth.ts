import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const requestPasswordResetSchema = z.object({
  email: z.email(),
});

export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

export const updatePasswordSchema = z.object({
  password: z.string().min(8, 'A palavra-passe deve ter pelo menos 8 caracteres.'),
});

export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
