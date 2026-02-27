//__________________________### 2025/10/02 implementation for rejected Vote ###_______________________________________

// server/controller/rejectVoteCount.js
// Purpose: return rejected vote counts grouped by reason.

const redisClient = require("../config/redis");

const getRejectedVotesCtrl = {
  getRejectedVoteCount: async (req, res) => {
    try {
      const electionId = req.query.electionId;
      if (!electionId) {
        return res.status(400).json({ message: "Election ID is required" });
      }

      const pattern = `RejectedVotes:${electionId}:*`;
      // Use KEYS here for simplicity (acceptable for moderate keyspace), otherwise SCAN.
      const keys = await redisClient.keys(pattern);

      if (!keys || keys.length === 0) {
        return res.status(200).json({
          rejectedCounts: {},
          totalRejected: 0,
        });
      }

      const rejectedCounts = {};
      for (const key of keys) {
        const val = await redisClient.get(key);
        const parts = key.split(":");
        const reason = parts[2] || "unknown";
        rejectedCounts[reason] = parseInt(val, 10) || 0;
      }

      const totalRejected = Object.values(rejectedCounts).reduce(
        (a, b) => a + b,
        0
      );
      console.log("🚫 Rejected counts:", rejectedCounts);
      return res.status(200).json({ rejectedCounts, totalRejected });
    } catch (err) {
      console.error("❌ Error fetching rejected votes:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },
};

module.exports = getRejectedVotesCtrl;
