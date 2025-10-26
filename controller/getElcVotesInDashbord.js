
//__________________________### 2025/10/02 Add Dynamic Array ###_______________________________________

const redisClient = require("../config/redis");
const addCandidateTable = require("../models/addCandidatesModel");

// In-memory dynamic array acting as your demo blockchain queue.
// NOTE: this is ephemeral (lost on server restart). That's okay for dev/demo.
// If you need durability later, push to Redis list or database instead.
let decrypted_Vote = [];

// Processing lock to avoid concurrent processing races
let processingLock = false;

// Election ID used across keys; can be parameterized later
const ELECTION_ID = "2025_president";

const manageShowVoteCtrl = {
  // POST /api/submit-vote
  // Accepts either a single string: { decrypted_vote: "1010...:Name" }
  // or an array: { decrypted_vote: ["1010...:Name", "1010...:Name"] }
  // This function will *only collect* votes into the in-memory array.
  getshowvot: async (req, res) => {
    try {
      const { decrypted_vote } = req.body;
      console.log("check the Array", decrypted_vote);

      if (!decrypted_vote) {
        return res
          .status(400)
          .json({ message: "🚫 decrypted_vote is required" });
      }

      // Normalize input: always push an array of strings
      if (Array.isArray(decrypted_vote)) {
        for (const v of decrypted_vote) {
          if (typeof v === "string" && v.trim().length > 0) {
            decrypted_Vote.push(v.trim());
          }
        }
      } else if (typeof decrypted_vote === "string") {
        //console.log("📥 Before push:", decrypted_Vote);
        decrypted_Vote.push(decrypted_vote.trim());
        //console.log("📥 After push (array content):", decrypted_Vote);
      } else {
        return res.status(400).json({
          message: "🚫 decrypted_vote must be string or array of strings",
        });
      }

      //console.log("📥 Collected votes (queue size):", decrypted_Vote.length);
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

  // GET /api/get-votes
  // Processes queued votes (validates, saves to Redis, increments rejected counters)
  // Returns an array of candidates with vote counts (suitable for front-end).
  getVoteCounts: async (req, res) => {
    try {
      // Prevent multiple simultaneous processors
      if (processingLock) {
        console.log(
          "⏳ Processing already in progress — returning current counts."
        );
        // Still return current counts (don't re-process)
        // fall through to fetch and return counts below
      } else {
        processingLock = true;
        console.log(
          "\n🔎 Processing queued votes... (count before processing)",
          decrypted_Vote.length
        );

        // Process the queue FIFO so votes are handled in arrival order.
        while (decrypted_Vote.length > 0) {
          const vote = decrypted_Vote.shift(); // removes front element
          console.log("➡️ Processing vote:", vote);

          // 1) Basic separator check
          if (!vote || typeof vote !== "string" || !vote.includes(":")) {
            await redisClient.incr(
              `RejectedVotes:${ELECTION_ID}:missing_separator`
            );
            console.log("   🚫 Rejected: missing ':' separator");
            continue;
          }

          // split into exactly two parts: binary and candidate name
          // use limit 2 to allow candidate names containing ":"
          const [voterRandomBitsRaw, ...rest] = vote.split(":");
          const candidateName = rest.join(":").trim(); // join remaining parts back
          const voterRandomBits = voterRandomBitsRaw.trim();

          // 2) Check that both parts exist
          if (!voterRandomBits || !candidateName) {
            await redisClient.incr(
              `RejectedVotes:${ELECTION_ID}:missing_fields`
            );
            console.log("   🚫 Rejected: missing fields");
            continue;
          }

          // 3) Validate 16-bit binary string
          if (!/^[01]{16}$/.test(voterRandomBits)) {
            await redisClient.incr(
              `RejectedVotes:${ELECTION_ID}:invalid_binary`
            );
            console.log("   🚫 Rejected: invalid 16-bit binary");
            continue;
          }

          // 4) Duplicate check using Redis SET NX EX (atomic)
          const codeKey = `voterRandomBits:${voterRandomBits}`;
          try {
            // set returns "OK" if set, null if not set (already exists)
            const setResult = await redisClient.set(codeKey, "1", {
              NX: true,
              EX: 86400, // 24 hours TTL
            });

            if (setResult === null) {
              // duplicate
              await redisClient.incr(
                `RejectedVotes:${ELECTION_ID}:duplicate_code`
              );
              console.log(`   🚫 Rejected: duplicate code ${voterRandomBits}`);
              continue;
            }
          } catch (err) {
            // If Redis errors here, count as rejected and continue
            console.error("   ⚠️ Redis error during duplicate check:", err);
            await redisClient.incr(`RejectedVotes:${ELECTION_ID}:redis_error`);
            continue;
          }

          // 5) Verify candidate exists in MongoDB
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

          // 6) Accept vote -> increment candidate count
          const safeCandidateName = candidateName.replace(/\s+/g, "_");
          const redisKey = `Votes:${ELECTION_ID}:${safeCandidateName}`;

          try {
            await redisClient.incr(redisKey);
            console.log(`   ✅ Accepted vote for ${candidateName}`);
          } catch (err) {
            console.error("   ⚠️ Redis error incrementing vote key:", err);
            // If increment fails, roll back the voterRandomBits key? (optional)
            // For now increment a redis_error reason counter
            await redisClient.incr(`RejectedVotes:${ELECTION_ID}:redis_error`);
          }
        } // end while queue

        processingLock = false;
        console.log("🔎 Queue processing finished.");
      }

      // After processing (or if another process was already running), fetch current candidate counts to return:
      const candidateList = await addCandidateTable.find();

      // Use SCAN (non-blocking) to discover vote keys: pattern Votes:ELECTION_ID:*
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
        //console.log("Keyyyy", keys);
      } while (cursor !== "0");

      const redisCounts = {};

      for (const key of keys) {
        const value = await redisClient.get(key);
        redisCounts[key] = parseInt(value, 10) || 0;
        //console.log("redis count check", redisCounts);
      }

      // Map DB candidates to counts (ensures candidate present even if 0 votes)
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

      //console.log("\n📊 Returning results:", results);
      return res.status(200).json(results);
    } catch (error) {
      console.error("❌ Failed to process votes:", error);
      processingLock = false; // ensure lock released on error
      return res.status(500).json({ message: "Failed to process votes 😕" });
    }
  },
};

module.exports = manageShowVoteCtrl;
