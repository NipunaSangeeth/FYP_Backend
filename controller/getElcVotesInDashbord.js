//__________________________### 2025/10/02 Add Dynamic Array ###_______________________________________
//------------2025/11/17-----Modify the Code REDIS clean Part----------------


const redisClient = require("../config/redis");
const addCandidateTable = require("../models/addCandidatesModel");

// In-memory dynamic array acting as your demo blockchain queue.
let decrypted_Vote = [];

// Processing lock to avoid concurrent processing races
let processingLock = false;

// Election ID used across keys; can be parameterized later
const ELECTION_ID = "2025_president";

const manageShowVoteCtrl = {
  // ============================================================
  //  POST /api/submit-vote
  //  Collect vote(s) temporarily in the in-memory decrypted_Vote array
  // ============================================================
  getshowvot: async (req, res) => {
    try {
      const { decrypted_vote } = req.body;
      console.log("check the Array", decrypted_vote);

      if (!decrypted_vote) {
        return res
          .status(400)
          .json({ message: "🚫 decrypted_vote is required" });
      }

      // Normalize input
      if (Array.isArray(decrypted_vote)) {
        for (const v of decrypted_vote) {
          if (typeof v === "string" && v.trim().length > 0) {
            decrypted_Vote.push(v.trim());
          }
        }
      } else if (typeof decrypted_vote === "string") {
        decrypted_Vote.push(decrypted_vote.trim());
      } else {
        return res.status(400).json({
          message: "🚫 decrypted_vote must be string or array of strings",
        });
      }

      return res.status(200).json({
        message: "☑️ Vote(s) received and stored temporarily",
        storedVote: decrypted_vote,
        currentQueueSize: decrypted_Vote.length,
      });
    } catch (err) {
      console.error("❌ Error in getshowvot:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  // ============================================================
  //  GET /api/get-votes
  //  Processes queued votes and returns live results
  // ============================================================
  getVoteCounts: async (req, res) => {
    try {
      if (processingLock) {
        console.log("⏳ Already processing. Returning counts...");
      } else {
        processingLock = true;
        console.log(
          "\n🔎 Processing queued votes... (count before processing)",
          decrypted_Vote.length
        );

        while (decrypted_Vote.length > 0) {
          const vote = decrypted_Vote.shift();
          console.log("➡️ Processing vote:", vote);

          // 1) Basic separator check
          if (!vote || typeof vote !== "string" || !vote.includes(":")) {
            await redisClient.incr(
              `RejectedVotes:${ELECTION_ID}:missing_separator`
            );
            console.log("   🚫 Rejected: missing ':' separator");
            continue;
          }

          // split
          const [voterRandomBitsRaw, ...rest] = vote.split(":");
          const candidateName = rest.join(":").trim();
          const voterRandomBits = voterRandomBitsRaw.trim();

          // 2) Check required parts
          if (!voterRandomBits || !candidateName) {
            await redisClient.incr(
              `RejectedVotes:${ELECTION_ID}:missing_fields`
            );
            console.log("   🚫 Rejected: missing fields");
            continue;
          }

          // 3) Validate bit string
          if (!/^[01]{16}$/.test(voterRandomBits)) {
            await redisClient.incr(
              `RejectedVotes:${ELECTION_ID}:invalid_binary`
            );
            console.log("   🚫 Rejected: invalid 16-bit binary");
            continue;
          }

          // 4) Duplicate check
          const codeKey = `voterRandomBits:${voterRandomBits}`;
          try {
            const setResult = await redisClient.set(codeKey, "1", {
              NX: true,
              EX: 86400,
            });

            if (setResult === null) {
              await redisClient.incr(
                `RejectedVotes:${ELECTION_ID}:duplicate_code`
              );
              console.log(`   🚫 Rejected: duplicate code ${voterRandomBits}`);
              continue;
            }
          } catch (err) {
            console.error("   ⚠️ Redis error:", err);
            await redisClient.incr(`RejectedVotes:${ELECTION_ID}:redis_error`);
            continue;
          }

          // 5) Candidate validation
          const candidate = await addCandidateTable.findOne({
            candidate_name: candidateName,
          });

          if (!candidate) {
            await redisClient.incr(
              `RejectedVotes:${ELECTION_ID}:invalid_candidate`
            );
            console.log(`   🚫 Rejected: invalid candidate ${candidateName}`);
            continue;
          }

          // 6) Accept vote
          const safeCandidateName = candidateName.replace(/\s+/g, "_");
          const redisKey = `Votes:${ELECTION_ID}:${safeCandidateName}`;

          try {
            await redisClient.incr(redisKey);
            console.log(`   ✅ Accepted vote for ${candidateName}`);
          } catch (err) {
            console.error("   ⚠️ Redis INCR error:", err);
            await redisClient.incr(`RejectedVotes:${ELECTION_ID}:redis_error`);
          }
        }

        processingLock = false;
        console.log("🔎 Queue processing finished.");
      }

      // Fetch Redis counts
      const candidateList = await addCandidateTable.find();

      let cursor = "0";
      let keys = [];
      const pattern = `Votes:${ELECTION_ID}:*`;
      do {
        const { cursor: nextCursor, keys: foundKeys } = await redisClient.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          100
        );
        cursor = nextCursor;
        keys = keys.concat(foundKeys || []);
      } while (cursor !== "0");

      const redisCounts = {};
      for (const key of keys) {
        const value = await redisClient.get(key);
        redisCounts[key] = parseInt(value, 10) || 0;
      }

      const results = candidateList.map((c) => {
        const safeName = c.candidate_name.replace(/\s+/g, "_");
        const redisKey = `Votes:${ELECTION_ID}:${safeName}`;
        return {
          name: c.candidate_name,
          number: c.candidate_number,
          image: c.candidate_image,
          votes: redisCounts[redisKey] || 0,
        };
      });

      return res.status(200).json(results);
    } catch (error) {
      console.error("❌ Failed to process votes:", error);
      processingLock = false;
      return res.status(500).json({ message: "Failed to process votes 😕" });
    }
  },

  
};

module.exports = manageShowVoteCtrl;

