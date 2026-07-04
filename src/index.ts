import { connectDB } from "./database/mongodb";
import app from "./app";
import { PORT } from './config';


async function startServer() {
    await connectDB();
    app.listen(
        PORT,
        "0.0.0.0",
        () => {
            console.log(`Server running on port ${PORT}`);
        }
    );

}

startServer();