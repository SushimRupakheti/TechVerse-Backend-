import z from 'zod';

export const userSchema=z.object({
    firstName: z.string().optional(),
    lastName:z.string().optional(),
    email:z.string().email('Invalid email address'),
    contactNo:z.string(),
    address:z.string(),  
    password:z.string().min(6),
    role: z.enum(["user", "admin"]).default("user"),
    profileImage: z.string().nullable().optional(),
});

export type UserType=z.infer<typeof userSchema>;