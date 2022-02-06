import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

function getDbName() {
    const dbName = process.env.MONGO_DB_NAME;
    if (!dbName) {
        throw new Error("no MONGO_DB_NAME set");
    }

    return dbName;
}

const motionCollectionName = "motion";
const proposalCollectionName = "proposal";
const userCollectionName = "user";
const alertCollectionName = "alert";

let client = null;
let db = null;
const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017";
let userCol = null;
let alertCol = null;
let motionCol = null;
let proposalCol = null;

export async function initDb() {
    client = await MongoClient.connect(mongoUri);

    const dbName = getDbName();
    console.log('dbName:', dbName);
    db = client.db(dbName);
    userCol = db.collection(userCollectionName);
    alertCol = db.collection(alertCollectionName);
    motionCol = db.collection(motionCollectionName);
    proposalCol = db.collection(proposalCollectionName);
    await _createIndexes();
}

async function _createIndexes() {
    if (!db) {
        console.error("Please call initDb first");
        process.exit(1);
    }
}

async function tryInit(col) {
    if (!col) {
        await initDb();
    }
}

export async function getUserCollection() {
    await tryInit(userCol);
    return userCol;
}

export async function getAlertCollection() {
    await tryInit(alertCol);
    return alertCol;
}

export async function getMotionCollection() {
    await tryInit(motionCol);
    return motionCol;
}

export async function getProposalCollection() {
    await tryInit(proposalCol);
    return proposalCol;
}