import z from 'zod';
import { userSchema } from '../types/user.type';

export const createUserDto = userSchema.pick(
    {

        firstName: true,
        lastName: true,
        email: true,
        contactNo: true,
        address: true,
        password: true,
        role: true,
        authProvider: true,
    }
).strict().extend({
    email: z.email().trim().toLowerCase(),
    password: z.string().min(6),
}).superRefine((data, ctx) => {
    // password validation
    if (!data.password || data.password.length < 6) {
      ctx.addIssue({
        path: ['password'],
        message: 'Password must be at least 6 characters long',
        code: z.ZodIssueCode.custom,
      });
    }
  });

export type createUserDto = z.infer<typeof createUserDto>;

export const LoginUserDto = z.object({
    email: z.email().trim().toLowerCase(),
    password: z.string().min(6)
}).strict();
export type LoginUserDto = z.infer<typeof LoginUserDto>;

export const VerifyTwoFactorSetupDto = z.object({
  otp: z.string().regex(/^\d{6}$/, "OTP must be a 6-digit code"),
});

export type VerifyTwoFactorSetupDto = z.infer<typeof VerifyTwoFactorSetupDto>;

export const VerifyTwoFactorLoginDto = z.object({
  email: z.email().trim().toLowerCase().optional(),
  userId: z.string().optional(),
  otp: z.string().regex(/^\d{6}$/, "OTP must be a 6-digit code"),
}).strict().refine((data) => data.email || data.userId, {
  message: "Email or userId is required",
  path: ["email"],
});

export type VerifyTwoFactorLoginDto = z.infer<typeof VerifyTwoFactorLoginDto>;

export const DisableTwoFactorDto = z.object({
  password: z.string().min(6),
}).strict();

export type DisableTwoFactorDto = z.infer<typeof DisableTwoFactorDto>;

export const UpdateProfileDto = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  contactNo: z.string().optional(),
  address: z.string().optional(),
  profileImage: z.string().nullable().optional(),
}).strict();

export type UpdateProfileDto = z.infer<typeof UpdateProfileDto>;
