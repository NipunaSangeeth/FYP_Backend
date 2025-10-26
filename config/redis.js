const { createClient } = require("redis");

// connecting the Redis Instance

const redisClient = createClient({
  url: "redis://localhost:6379",
});

// listn for the Redis
redisClient.on("error", (err) => {
  console.error("❌ Redis Client Error:", err);
});
// connecting to the redis
(async () => {
  await redisClient.connect();
  console.log("✅ Redis connected!");
})();

module.exports = redisClient;
