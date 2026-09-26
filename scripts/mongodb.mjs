import { MongoClient } from "mongodb";

if (!process.env.MONGODB_URI) process.loadEnvFile("atlas-credentials.env");
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI est absent.");

export const mongoClient = new MongoClient(process.env.MONGODB_URI);
await mongoClient.connect();
export const mongoDb = mongoClient.db(process.env.MONGODB_DB ?? "fileo");

export async function closeMongo() {
  await mongoClient.close();
}
