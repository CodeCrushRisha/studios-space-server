import express from "express";
import { MongoClient } from 'mongodb';
import 'dotenv/config'
import dns from "node:dns/promises";
dns.setServers(["1.1.1.1", "8.8.8.8"]);
const app = express();

const PORt =8000




const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}
 connectToMongoDB()


 app.post('/add-destination', async (req, res) => {
    console.log("Received request to add destination");
    res.send("Destination added successfully")});

//http://localhost:8000/add-destination

app.get("/", (req, res) => {
    res.send("Hello World");
});

app.listen( PORt, () => {
    console.log(`Server is running on port ${PORt}`);
});