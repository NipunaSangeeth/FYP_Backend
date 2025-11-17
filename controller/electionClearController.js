// ---Clear the Redis and Mongo----

const redisClient = require("../config/redis");
const addMemberTable = require("../models/addMemberModel");

let decrypted_Vote = [];
let processingLock = false;

const ELECTION_ID = "2025_president";

const electionClearController = {
  clearElectionData: async (req, res) => {
    try {
      console.log("🧹 Starting full election reset...");

      const deleteByPattern = async (pattern) => {
        let cursor = "0";

        do {
          const reply = await redisClient.scan(cursor, "MATCH", pattern, "COUNT", 100);

          // Normalize
          let newCursor = Array.isArray(reply) ? reply[0] : reply.cursor;
          cursor = newCursor;

          let keys =
            Array.isArray(reply) ? reply[1] || [] : reply.keys || [];

          if (keys.length > 0) {
            // 🔥 FIX: Delete keys one-by-one (works 100% always)
            await Promise.all(keys.map((key) => redisClient.del(key)));
            console.log(`🚮 Deleted ${keys.length} keys for ${pattern}`);
          }

        } while (cursor !== "0");
      };

      // Delete Redis keys
      await deleteByPattern(`Votes:${ELECTION_ID}:*`);
      await deleteByPattern(`RejectedVotes:${ELECTION_ID}:*`);
      await deleteByPattern(`voterRandomBits:*`);

      // Clear memory
      decrypted_Vote = [];
      processingLock = false;

      // Clear MongoDB
      await addMemberTable.deleteMany({});
      console.log("🗑️ MongoDB addmembers cleared");

      return res.status(200).json({
        success: true,
        message: "Election data fully cleared (Redis + MongoDB + memory).",
      });

    } catch (err) {
      console.error("❌ Error clearing election:", err);
      return res.status(500).json({
        success: false,
        message: "Error clearing election data.",
      });
    }
  },
};

module.exports = electionClearController;
