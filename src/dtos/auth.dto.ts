import z, { email } from 'zod';
import { userSchema } from '../types/user.type';

export const createUserDto=userSchema.pick(
    {

        firstName:true,
        lastName:true,
        email:true,
        contactNo:true,
        address:true,
        password:true,
        role:true
    }
).superRefine((data, ctx) => {
    // password validation
    if (data.password.length < 6) {
      ctx.addIssue({
        path: ['password'],
        message: 'Password must be at least 6 characters long',
        code: z.ZodIssueCode.custom,
      });
    }
  });

export type createUserDto=z.infer<typeof createUserDto>;

export const LoginUserDto=z.object({
    email:z.email(),
    password:z.string().min(6)
})
export type LoginUserDto=z.infer<typeof LoginUserDto>;

export const UpdateProfileDto = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  contactNo: z.string().optional(),
  address: z.string().optional(),
  profileImage: z.string().nullable().optional(),
});

export type UpdateProfileDto = z.infer<typeof UpdateProfileDto>;
