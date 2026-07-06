import z from 'zod';

export const userSchema=z.object({
    firstName: z.string().optional(),
    lastName:z.string().optional(),
    email:z.string().email('Invalid email address'),
    contactNo:z.string().optional(),
    address:z.string().optional(),
    password:z.string().min(6).optional(),
    googleId: z.string().optional(),
    authProvider: z.enum(["local", "google"]).default("local"),
    role: z.enum(["customer", "user", "admin"]).default("customer"),
    profileImage: z.string().nullable().optional(),
    twoFactorEnabled: z.boolean().default(false).optional(),
    twoFactorSecret: z.string().nullable().optional(),
});

export type UserType=z.infer<typeof userSchema>;
