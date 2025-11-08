// const express = require("express");
// const cors = require("cors");
// const cookieParser = require("cookie-parser");
// require("dotenv").config();

// const connectDB = require("./config/db");
// const router = require("./routes");
// const redisClient = require("./config/redis");

// const app = express();
// app.use(express.json({ limit: "10mb" })); // Increase limit as needed
// app.use(express.urlencoded({ limit: "10mb", extended: true })); // Increase limit as needed
// app.use(express.json()); // Middleware for Parsing Request Body
// app.use(cookieParser()); // Manage the Cookies, help to Store a WEBTOKEN for authentication

// app.use(
//   cors({
//     origin: process.env.FRONTEND_URL || "http://localhost:3000", // Your client URL
//     credentials: true, // Allow credentials
//   })
// );

// app.use("/api", router);

// const PORT = 8000 || process.env.PORT;

// connectDB().then(() => {
//   app.listen(PORT, () => {
//     // console.log("Connect To The MongoDB");
//     // console.log("Server is Running....");
//     console.log(`✅ MongoDB connected`);
//     console.log(`✅ Redis ready`);
//     console.log(`🚀 Server running on port ${PORT}`);
//   });
// });

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const connectDB = require("./config/db");
const router = require("./routes");
const redisClient = require("./config/redis");

const app = express();
app.use(express.json({ limit: "10mb" })); // Increase limit as needed
app.use(express.urlencoded({ limit: "10mb", extended: true })); // Increase limit as needed
app.use(express.json()); // Middleware for Parsing Request Body
app.use(cookieParser()); // Manage the Cookies, help to Store a WEBTOKEN for authentication

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000", // Your client URL
    credentials: true, // Allow credentials
  })
);
app.use("/api", router);

const PORT = 8000 || process.env.PORT;

connectDB().then(() => {
  app.listen(PORT, () => {
    // console.log("Connect To The MongoDB");
    // console.log("Server is Running....");
    console.log(`✅ MongoDB connected`);
    console.log(`✅ Redis ready`);
    console.log(`🚀 Server running on port ${PORT}`);
  });
});
