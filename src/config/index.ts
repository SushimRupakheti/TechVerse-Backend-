import dotenv from 'dotenv';

dotenv.config();

export const PORT:number=
process.env.PORT? parseInt(process.env.PORT):5050;

//ensure PORT is a number, and fallback if not found
//avoid exception if env is missing

export const MONGO_URI:string=
process.env.MONGO_URI || 'mongodb://localhost:27017/recell_bazar'

//fallback to local mongo db if env is missing

//application lelevel constants

export const JWT_SECRET: string = process.env.JWT_SECRET || 'defaultsecret';
// Stripe configuration
export const STRIPE_SECRET_KEY: string = process.env.STRIPE_SECRET_KEY || '';
export const STRIPE_WEBHOOK_SECRET: string = process.env.STRIPE_WEBHOOK_SECRET || '';
