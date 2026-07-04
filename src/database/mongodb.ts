import mongoose from "mongoose";
import { MONGO_URI } from "../config";

function resolveMongoUri() {
    const nodeEnv = (process.env.NODE_ENV || "").toLowerCase();
    if (nodeEnv === "test") {
        return (process.env.MONGO_URI_TEST || process.env.MONGO_URI || "").trim();
    }
    return (MONGO_URI || "").trim();
}

export const connectDB =async()=>{
    try{
        const uri = resolveMongoUri();
        if (!uri) {
            throw new Error("MongoDB URI missing. Set MONGO_URI (or MONGO_URI_TEST when NODE_ENV=test).");
        }

        await mongoose.connect(uri);

        // Keep test output clean
        if ((process.env.NODE_ENV || "").toLowerCase() !== "test") {
            console.log("MongoDB connected");
        }
        try {
            const coll = mongoose.connection.collection('stripepayments');
            const indexes = await coll.indexes();
            const sessionIndex = indexes.find((idx: any) => idx.name === 'sessionId_1');
            const intentIndex = indexes.find((idx: any) => idx.name === 'paymentIntentId_1');

            if (sessionIndex && (!sessionIndex.unique || !sessionIndex.sparse)) {
                await coll.dropIndex('sessionId_1');
            }
            if (intentIndex && (!intentIndex.unique || !intentIndex.sparse)) {
                await coll.dropIndex('paymentIntentId_1');
            }

            try {
                await coll.createIndex({ sessionId: 1 }, { unique: true, sparse: true });
            } catch (e: any) {
                console.warn('Could not ensure unique sparse index on sessionId:', e.message || e);
            }

            try {
                await coll.createIndex({ paymentIntentId: 1 }, { unique: true, sparse: true });
            } catch (e: any) {
                console.warn('Could not ensure unique sparse index on paymentIntentId:', e.message || e);
            }
        } catch (idxErr: any) {
            console.warn('Index migration for stripepayments skipped:', idxErr.message || idxErr);
        }
    }catch(error){
        console.error("db error",error);
        process.exit(1);
    }
}
