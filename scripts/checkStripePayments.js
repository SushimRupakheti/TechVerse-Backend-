require('dotenv').config();
const mongoose = require('mongoose');

const MONGO = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/meroNayaDB';

async function run(){
  try{
    await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = mongoose.connection.db;
    const names = await db.listCollections().toArray();
    console.log('Collections:', names.map(n=>n.name));
    const col = db.collection('stripepayments');
    const docs = await col.find({}).sort({ _id: -1 }).limit(10).toArray();
    console.log('Latest stripepayments (up to 10):', JSON.stringify(docs, null, 2));
    await mongoose.disconnect();
    process.exit(0);
  }catch(err){
    console.error('Error querying MongoDB:', err);
    process.exit(2);
  }
}

run();


//hello bro i am new login