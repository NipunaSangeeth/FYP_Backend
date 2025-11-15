const mongoose = require("mongoose");

async function connectDB() {
  try {
    mongoose.set("strictQuery", true);

    await mongoose.connect(process.env.MONGODB_URL, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 30000, // Wait 30s for primary
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
    });

    mongoose.connection.on("connected", () => {
      console.log("📡 MongoDB Connection: LIVE");
    });

    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB Connection Error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️ MongoDB Disconnected. Trying to reconnect...");
    });

    return true;
  } catch (err) {
    console.error("❌ Initial MongoDB Connection Failed:", err);
    process.exit(1);
  }
}

module.exports = connectDB;
