import z from 'zod';
import { userSchema } from '../types/user.type';
import { sanitizeUserText } from '../utils/xss-sanitizer';

export const strongPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/\d/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

const registerUserBaseDto = userSchema.pick(
    {
        firstName: true,
        lastName: true,
        email: true,
        contactNo: true,
        address: true,
        password: true,
    }
).strict().extend({
    email: z.email().trim().toLowerCase(),
    password: strongPasswordSchema,
});

export const PublicRegisterUserDto = registerUserBaseDto;

export type PublicRegisterUserDto = z.infer<typeof PublicRegisterUserDto>;

export const createUserDto = registerUserBaseDto.extend({
    role: z.enum(["customer", "user", "admin"]).default("customer"),
    authProvider: z.enum(["local", "google"]).default("local"),
});
export type createUserDto = z.infer<typeof createUserDto>;

export const LoginUserDto = z.object({
    email: z.email().trim().toLowerCase(),
    password: z.string().min(6)
}).strict();
export type LoginUserDto = z.infer<typeof LoginUserDto>;

export const ResendVerificationDto = z.object({
  email: z.email().trim().toLowerCase(),
}).strict();

export type ResendVerificationDto = z.infer<typeof ResendVerificationDto>;

export const ResetPasswordDto = z.object({
  newPassword: strongPasswordSchema,
}).strict();

export type ResetPasswordDto = z.infer<typeof ResetPasswordDto>;

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

const profileText = (field: string, max: number) =>
  z
    .string({ message: `${field} must be a string` })
    .transform((value) => sanitizeUserText(value))
    .refine((value) => value.length > 0, `${field} cannot be empty`)
    .refine((value) => value.length <= max, `${field} must be at most ${max} characters`);

const profileImage = z
  .string()
  .trim()
  .max(500, "Profile image URL is too long")
  .refine(
    (value) => value.startsWith("/") || /^https:\/\//i.test(value),
    "Profile image must be a relative path or HTTPS URL"
  );

export const UpdateProfileDto = z
  .object({
    firstName: profileText("First name", 50).optional(),
    lastName: profileText("Last name", 50).optional(),
    contactNo: z
      .string()
      .trim()
      .min(7, "Contact number must be at least 7 characters")
      .max(30, "Contact number must be at most 30 characters")
      .regex(/^\+?[0-9() -]+$/, "Contact number contains invalid characters")
      .optional(),
    address: profileText("Address", 200).optional(),
    profileImage: profileImage.nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, "At least one profile field is required");

export type UpdateProfileDto = z.infer<typeof UpdateProfileDto>;

export const AdminUpdateUserDto = z
  .object({
    firstName: profileText("First name", 50).optional(),
    lastName: profileText("Last name", 50).optional(),
    contactNo: z.string().trim().min(7).max(30).regex(/^\+?[0-9() -]+$/).optional(),
    address: profileText("Address", 200).optional(),
    profileImage: profileImage.nullable().optional(),
    role: z.enum(["customer", "user", "admin"]).optional(),
    isVerified: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, "At least one user field is required");

export type AdminUpdateUserDto = z.infer<typeof AdminUpdateUserDto>;
