const mongoose = require("mongoose");

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
  } catch (err) {
    console.log(err);
  }
}
module.exports = connectDB;

// const mongoose = require("mongoose");

// async function connectDB() {
//   try {
//     await mongoose.connect(process.env.MONGODB_URL);
//   } catch (err) {
//     console.log(err);
//   }
// }

// module.exports = connectDB;
