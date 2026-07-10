import mongoose from "mongoose";

// Some integration tests can be slow on first DB connect.
jest.setTimeout(60_000);

beforeAll(async () => {
    // Jest usually sets this already, but make it explicit.
    process.env.NODE_ENV = "test";

    // If you want full isolation from your dev DB, set:
    //   MONGO_URI_TEST=mongodb://127.0.0.1:27017/<your_test_db>
    const { connectDB } = require("../database/mongodb");
    await connectDB();
});

afterAll(async () => {
    await mongoose.connection.close();
});
