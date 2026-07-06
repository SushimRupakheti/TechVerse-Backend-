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
export const CLIENT_URL: string = process.env.CLIENT_URL || 'http://localhost:3000';
export const FRONTEND_URL: string = process.env.FRONTEND_URL || CLIENT_URL;
export const BACKEND_URL: string = process.env.BACKEND_URL || `http://localhost:${PORT}`;
export const GOOGLE_CLIENT_ID: string = process.env.GOOGLE_CLIENT_ID || '';
export const GOOGLE_CLIENT_SECRET: string = process.env.GOOGLE_CLIENT_SECRET || '';
export const NODE_ENV: string = process.env.NODE_ENV || 'development';
// Stripe configuration
export const STRIPE_SECRET_KEY: string = process.env.STRIPE_SECRET_KEY || '';
export const STRIPE_WEBHOOK_SECRET: string = process.env.STRIPE_WEBHOOK_SECRET || '';

export const EMAIL_USER: string =
    process.env.EMAIL_USER || 'meroemail.com'

export const EMAIL_PASS: string =
    process.env.EMAIL_PASS || 'password';
