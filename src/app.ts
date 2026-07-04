import express , { Application, Request, Response } from 'express';

import { connectDB } from './database/mongodb';
import bodyParser from 'body-parser';
import { PORT } from './config';

import authRoutes from './routes/auth.route';
import adminUserRoute from './routes/admin/user.route';
import adminItemRoute from './routes/admin/item.route';
import adminPaymentRoute from './routes/admin/payment.route';
import itemRoutes from './routes/item.route';
import paymentRoutes from './routes/payment.route';
import cartRoutes from './routes/cart.route';
import notificationRoutes from './routes/notification.route';
import adminNotificationRoute from './routes/admin/notification.route';
import paymentController from './controllers/payment.controller';

import cors from "cors";
import path from "path";




// dotenv.config();

const app: Application = express();
// const PORT: number = 3000;
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

// Stripe webhook needs raw body for signature verification — register before JSON parser
app.post(
  '/api/payments/stripe/webhook',
  express.raw({ type: 'application/json' }),
  (req: Request, res: Response) => paymentController.handleStripeWebhook(req, res)
);

app.use(express.json());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use("/api/users", authRoutes);


app.get('/', (req: Request, res: Response) => {
    res.send('Hello, World!');
});

 
app.use('/api/auth', authRoutes);
app.use('/api/admin/users', adminUserRoute);
app.use('/api/admin/items', adminItemRoute);
app.use('/api/admin/payments', adminPaymentRoute);
app.use('/api/admin/notifications', adminNotificationRoute);
app.use("/uploads", express.static("uploads"));

app.use("/api/items", itemRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/notifications", notificationRoutes);


app.use("/uploads", express.static(path.join(__dirname, "../itemPhotoUploads")));

app.get('/api/test', (req, res) => {
  res.status(200).json({ message: 'API working' });
});
export default app;