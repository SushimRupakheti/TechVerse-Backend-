import { connectDB } from "./database/mongodb";
import app from "./app";
import { PORT } from './config';
import mongoose from "mongoose";


async function startServer() {
    await connectDB();
    const server = app.listen(
        PORT,
        "0.0.0.0",
        () => {
            console.log(`Server running on port ${PORT}`);
        }
    );

    const shutdown = (signal: string) => {
        console.log(`${signal} received, shutting down gracefully`);
        server.close(async () => {
            await mongoose.connection.close();
            process.exit(0);
        });
    };

    process.once("SIGINT", () => shutdown("SIGINT"));
    process.once("SIGTERM", () => shutdown("SIGTERM"));

}

startServer().catch((error) => {
    console.error("Server startup failed", error);
    process.exit(1);
});
