// // server/controller/getSisElcVotesInDashbord.js
// const router = require("../routes");
// const redisClient = require("../config/redis");
// const addCandidateTable = require("../models/addCandidatesModel");

// /**
//  * Small Lua script used to:
//  *  - If key doesn't exist, create it with value 0 and set an expiry (ARGV[1] seconds).
//  *  - Then INCR the key and return the new value.
//  * This makes "first-create-with-ttl + incr" atomic and race-free.
//  */
// const LUA_INCR_WITH_TTL = `
//   if redis.call("exists", KEYS[1]) == 0 then
//     redis.call("set", KEYS[1], 0, "EX", ARGV[1])
//   end
//   return redis.call("incr", KEYS[1])
// `;

// /**
//  * Helper: Normalizes candidate name coming from payload.
//  * - Replace underscores with spaces so "Kasun_Sabasignha" -> "Kasun Sabasignha"
//  * - Trim.
//  * - This makes it tolerant to clients sending either spaced or underscore names.
//  */
// function normalizeCandidateNameForDb(name) {
//   if (!name || typeof name !== "string") return "";
//   return name.replace(/_/g, " ").trim();
// }

// /**
//  * Helper: Prepare a safe Redis key name from candidate name
//  * - Replace sequences of whitespace with single underscore.
//  * - Remove characters that might break keys (optional).
//  */
// function safeRedisCandidateName(name) {
//   return name
//     .trim()
//     .replace(/\s+/g, "_") // spaces -> underscore
//     .replace(/[^\w\-]/g, ""); // remove any non-word (keep letters/numbers/underscore/dash)
// }

// const manageShowVoteCtrl = {
//   /**
//    * POST /api/submit-vote
//    * Accepts { decrypted_vote: "1010101011001101:Kasun Subasignha" }
//    * Validations:
//    *  - must include ':'
//    *  - first part must be 16 bit binary string
//    *  - random bits must be unique (voterRandomBits:... NX+EX)
//    *  - candidate name must exist in MongoDB (case-insensitive match)
//    * If valid:
//    *  - increment Votes:2025_president:{safeName} atomically and ensure TTL 24h
//    * If invalid:
//    *  - increment RejectedVotes:2025_president:{reason} (with TTL)
//    */
//   getshowvot: async (req, res) => {
//     try {
//       const { decrypted_vote } = req.body;

//       console.log("\n🔵 ================================");
//       console.log(`📥 Incoming decrypted vote: ${decrypted_vote}`);
//       console.log("🔵 ================================");

//       // Basic type-check
//       if (!decrypted_vote || typeof decrypted_vote !== "string") {
//         // record rejected vote (missing_payload) and return
//         await redisClient.eval(LUA_INCR_WITH_TTL, {
//           keys: ["RejectedVotes:2025_president:missing_payload"],
//           arguments: ["86400"],
//         });
//         return res.status(400).json({ message: "🚫 Missing decrypted_vote" });
//       }

//       const voteTrimmed = decrypted_vote.trim();

//       // 1) Check ':' separator presence quickly
//       if (!voteTrimmed.includes(":")) {
//         await redisClient.eval(LUA_INCR_WITH_TTL, {
//           keys: ["RejectedVotes:2025_president:missing_separator"],
//           arguments: ["86400"],
//         });
//         return res
//           .status(400)
//           .json({ message: "🚫 Missing ':' separator — vote rejected" });
//       }

//       // Split into parts
//       const part = voteTrimmed.split(":");
//       const voterRandomBits = (part[0] || "").trim();
//       let candidateNameRaw = (part[1] || "").trim();

//       // Basic parts existence validation
//       if (!voterRandomBits || !candidateNameRaw) {
//         await redisClient.eval(LUA_INCR_WITH_TTL, {
//           keys: ["RejectedVotes:2025_president:missing_fields"],
//           arguments: ["86400"],
//         });
//         console.log("🚫 Invalid Vote Format — missing fields");
//         return res.status(400).json({ message: "🚫 Invalid Vote Format" });
//       }

//       // Validate binary length: must be exactly 16 chars, only 0/1
//       if (!/^[01]{16}$/.test(voterRandomBits)) {
//         await redisClient.eval(LUA_INCR_WITH_TTL, {
//           keys: ["RejectedVotes:2025_president:invalid_binary"],
//           arguments: ["86400"],
//         });
//         return res
//           .status(400)
//           .json({ message: "🚫 Invalid binary code — vote rejected" });
//       }

//       // 1.a Check duplicate vote code (unique random bits) with NX + EX
//       const codeKey = `voterRandomBits:${voterRandomBits}`;
//       const setResult = await redisClient.set(codeKey, "1", {
//         NX: true,
//         EX: 86400, // 24 hours
//       });

//       // If setResult === null, key already existed -> duplicate code
//       if (setResult === null) {
//         await redisClient.eval(LUA_INCR_WITH_TTL, {
//           keys: ["RejectedVotes:2025_president:duplicate_code"],
//           arguments: ["86400"],
//         });
//         console.log(`🚫 Duplicate vote code detected: ${voterRandomBits}`);
//         return res
//           .status(400)
//           .json({ message: "🚫 Duplicate vote code — vote rejected" });
//       }

//       // Normalize candidate name for DB lookup (turn underscores -> spaces)
//       const candidateNameForDb = normalizeCandidateNameForDb(candidateNameRaw);

//       // Validate candidate exists in MongoDB (case-insensitive exact match)
//       // We use a case-insensitive regex anchored to start/end to match exact name ignoring case.
//       const candidate = await addCandidateTable.findOne({
//         candidate_name: { $regex: `^${candidateNameForDb.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}$`, $options: "i" },
//       });

//       if (!candidate) {
//         // candidate not found -> rejected
//         await redisClient.eval(LUA_INCR_WITH_TTL, {
//           keys: ["RejectedVotes:2025_president:invalid_candidate"],
//           arguments: ["86400"],
//         });
//         console.log(`🚫 [Rejected] Invalid candidate name: ${candidateNameRaw}`);
//         return res.status(400).json({
//           message: "🚫 Invalid candidate name — vote rejected",
//         });
//       }

//       // Build redis-safe key for this candidate and atomically incr+ensure TTL (24h)
//       const safeCandidateName = safeRedisCandidateName(candidate.candidate_name);
//       const redisKey = `Votes:2025_president:${safeCandidateName}`;

//       try {
//         // Atomic increment + set TTL if first created
//         await redisClient.eval(LUA_INCR_WITH_TTL, {
//           keys: [redisKey],
//           arguments: ["86400"], // 24h seconds
//         });

//         console.log(`✅ [Accepted] Vote counted for ${candidate.candidate_name}`);
//         return res.status(200).json({
//           message: `☑️ Vote counted for: ${candidate.candidate_name}`,
//         });
//       } catch (err) {
//         console.error("❌ Failed to count vote (redis incr):", err);
//         // If redis fails here, we could consider removing the codeKey (voterRandomBits) to allow retry,
//         // but be cautious about duplicates — for now return server error.
//         return res.status(500).json({ message: "Server error counting vote" });
//       }
//     } catch (error) {
//       console.error("❌ Unexpected server error in getshowvot:", error);
//       return res.status(500).json({ message: "Server error" });
//     }
//   },

//   /**
//    * GET /api/get-votes
//    * Return array of candidates with { name, number, votes }
//    * (Reads candidates from MongoDB and pulls counts from Redis)
//    */
//   getVoteCounts: async (req, res) => {
//     try {
//       const candidate = await addCandidateTable.find();

//       let cursor = "0";
//       let keys = [];
//       const pattern = "Votes:2025_president:*";

//       // Use SCAN to avoid blocking
//       do {
//         const { cursor: nextCursor, keys: foundKeys } = await redisClient.scan(
//           cursor,
//           "MATCH",
//           pattern,
//           "COUNT",
//           "100"
//         );
//         cursor = nextCursor; // string cursor
//         keys = keys.concat(foundKeys);
//       } while (cursor !== "0");

//       // Map Redis keys to counts
//       const redisCounts = {};
//       for (const key of keys) {
//         const count = await redisClient.get(key);
//         redisCounts[key] = parseInt(count || "0", 10);
//       }

//       // Build result list matching Mongo candidates order
//       const results = candidate.map((c) => {
//         const safeName = safeRedisCandidateName(c.candidate_name);
//         const redisKey = `Votes:2025_president:${safeName}`;
//         return {
//           name: c.candidate_name,
//           number: c.candidate_number,
//           // image or other fields can be included
//           votes: redisCounts[redisKey] || 0,
//         };
//       });

//       console.log("\n📊 ================================");
//       console.log("📊 Current VALID vote counts:");
//       console.log(results);
//       console.log("📊 ================================");

//       res.status(200).json(results);
//     } catch (error) {
//       console.error("❌ Failed to get vote counts", error);
//       res.status(500).json({ message: "Failed to get vote counts 😕" });
//     }
//   },
// };

// module.exports = manageShowVoteCtrl;




// server/routes/index.js
// const express = require("express");
// const router = express.Router();

// const manageMemberCtrl = require("../controller/addMember");
// const manageCandidateCtrl = require("../controller/addCandidates");
// const manageSignUpCtrl = require("../controller/userSignUp");
// const manageSignInCtrl = require("../controller/userSignin");
// const manageCandidateSisElecCtrl = require("../controller/addCandidateSisElec");
// const manageSisMemberCtrl = require("../controller/addMemberSisElec");
// const manageShowVoteCtrl = require("../controller/getElcVotesInDashbord");
// const managerejectedVoteCtrl = require("../controller/rejectVoteCount");

// // ~~~~~~~~~~~~~ Router For Api ~~~~~~~~~
// router.post("/signup", manageSignUpCtrl.userSignUpData);
// router.post("/signin", manageSignInCtrl.userSignInData);

// // Members / Candidates
// router.post("/addmember", manageMemberCtrl.addMemberData);
// router.get("/get-addmember", manageMemberCtrl.getMember);

// router.post("/addvoter", manageSisMemberCtrl.addSismemberData);
// router.get("/get-addvoter", manageSisMemberCtrl.getSisMemberElec);

// router.post("/addcandidate", manageCandidateCtrl.addCandidateData);
// router.get("/get-addcandidate", manageCandidateCtrl.getcandidate);

// router.post("/addcandidate-sis-elec", manageCandidateSisElecCtrl.addCandidateSisElecData);
// router.get("/get-addcandidate-sis-elec", manageCandidateSisElecCtrl.getCandidateSisElec);

// // Vote endpoints
// router.post("/submit-vote", manageShowVoteCtrl.getshowvot); // collect into array
// router.get("/get-votes", manageShowVoteCtrl.getVoteCounts); // process queue & return counts

// // Rejected votes
// router.get("/rejected-vote-counts", managerejectedVoteCtrl.getRejectedVoteCount);

// module.exports = router;
// 

// __________code for Create election controlers___________
// const Election = require("../../models/createElectionModel");

// // Helper to convert delay string to ms
// const delayStringToMs = (s) => {
//   if (!s) return 0;
//   const map = {
//     "10min": 10 * 60 * 1000,
//     "30min": 30 * 60 * 1000,
//     "1h": 60 * 60 * 1000,
//     "2h": 2 * 60 * 60 * 1000,
//     "6h": 6 * 60 * 60 * 1000,
//     "12h": 12 * 60 * 60 * 1000,
//     "24h": 24 * 60 * 60 * 1000,
//   };
//   return map[s] || parseInt(s, 10) || 0;
// };

// // Combine date (YYYY-MM-DD) + time (HH:mm:ss) -> Date object (local)
// const combineDateTime = (dateStr, timeStr) => {
//   // If timeStr missing, default to 00:00:00
//   const time = timeStr && timeStr.trim() ? timeStr.trim() : "00:00:00";
//   // Build ISO-ish string. This will create a Date in local timezone.
//   const iso = `${dateStr}T${time}`;
//   return new Date(iso);
// };

// const createElectionCtrl = {
//   // POST /api/create-election
//   createElectionData: async (req, res) => {
//     try {
//       const {
//         electionType,
//         nominationStartDate,
//         nominationStartTime,
//         nominationEndDate,
//         nominationEndTime,
//         delayBeforeStart, // e.g. "10min"
//         electionStartDate,
//         electionStartTime,
//         electionEndDate,
//         electionEndTime,
//         createdBy,
//       } = req.body;

//       // Minimal validation
//       if (
//         !electionType ||
//         !nominationStartDate ||
//         !nominationEndDate ||
//         !electionStartDate ||
//         !electionEndDate
//       ) {
//         return res.status(400).json({ message: "Missing required fields" });
//       }

//       const nominationStartAt = combineDateTime(
//         nominationStartDate,
//         nominationStartTime
//       );
//       const nominationEndAt = combineDateTime(
//         nominationEndDate,
//         nominationEndTime
//       );
//       const electionStartAt = combineDateTime(
//         electionStartDate,
//         electionStartTime
//       );
//       const electionEndAt = combineDateTime(electionEndDate, electionEndTime);

//       const startDelayMs = delayStringToMs(delayBeforeStart);

//       // Compute the actual start time:
//       // Some rules: the start should be the later of (nominationEndAt + delay) and electionStartAt
//       const nominationPlusDelay = new Date(
//         nominationEndAt.getTime() + startDelayMs
//       );
//       const computedStartAt =
//         nominationPlusDelay > electionStartAt
//           ? nominationPlusDelay
//           : electionStartAt;

//       const newElection = new Election({
//         electionType,
//         nominationStartAt,
//         nominationEndAt,
//         startDelayMs,
//         electionStartAt,
//         electionEndAt,
//         computedStartAt,
//         status: "scheduled",
//         createdBy: createdBy || "admin",
//       });

//       await newElection.save();

//       console.log(
//         `✅ New election created (${electionType}) id=${
//           newElection._id
//         } scheduledStart=${computedStartAt.toISOString()}`
//       );

//       return res.status(201).json({
//         message: "Election created and scheduled",
//         electionId: newElection._id,
//         scheduledStart: computedStartAt,
//       });
//     } catch (err) {
//       console.error("❌ Error create-election:", err);
//       return res.status(500).json({ message: "Internal Server Error" });
//     }
//   },

// //   Optional: list elections (useful for admin)
//     list: async (req, res) => {
//       try {
//         const list = await Election.find().sort({ createdAt: -1 }).lean();
//         res.status(200).json(list);
//       } catch (err) {
//         console.error("❌ Error listing elections:", err);
//         res.status(500).json({ message: "Internal Server Error" });
//       }
//     },
// };

// module.exports = createElectionCtrl;

// const createElectionTable = require("../models/createElectionModel");
// const cron = require("node-cron");
// const dayjs = require("dayjs");

// // Convert delay string (like 10min, 1h, 24h) into milliseconds
// function convertDelayToMs(delay) {
//   if (!delay) return 0;
//   const num = parseInt(delay);
//   if (delay.includes("min")) return num * 60 * 1000;
//   if (delay.includes("h")) return num * 60 * 60 * 1000;
//   return 0;
// }

// const createElectionCtrl = {
//   createElection: async (req, res) => {
//     try {
//       const {
//         electionType,
//         nominationStartDate,
//         nominationStartTime,
//         nominationEndDate,
//         nominationEndTime,
//         delayBeforeStart,
//         electionStartDate,
//         electionStartTime,
//         electionEndDate,
//         electionEndTime,
//       } = req.body;

//       // Save to MongoDB
//       const newElection = new createElectionTable({
//         electionType,
//         nominationStartDate,
//         nominationStartTime,
//         nominationEndDate,
//         nominationEndTime,
//         delayBeforeStart,
//         electionStartDate,
//         electionStartTime,
//         electionEndDate,
//         electionEndTime,
//       });

//       await newElection.save();
//       console.log("✅ Election saved to MongoDB:", newElection._id);

//       // Start background cron job if not already
//       if (!global.electionSchedulerStarted) {
//         startElectionScheduler();
//         global.electionSchedulerStarted = true;
//       }

//       res.json({
//         success: true,
//         message: "Election created successfully and scheduled!",
//         election: newElection,
//       });
//     } catch (error) {
//       console.error("❌ Error creating election:", error);
//       res.status(500).json({
//         success: false,
//         message: "Server error while creating election",
//       });
//     }
//   },
// };

// // -----------------------------
// // 🔁 CRON JOB CONFIGURATION
// // -----------------------------
// function startElectionScheduler() {
//   console.log("🕒 Scheduler started: checking every 30 seconds...");

//   cron.schedule("*/30 * * * * *", async () => {
//     try {
//       const now = dayjs();

//       // Find all elections
//       const elections = await createElectionTable.find();

//       for (const election of elections) {
//         const startTime = dayjs(
//           `${election.electionStartDate} ${election.electionStartTime}`
//         );
//         const endTime = dayjs(
//           `${election.electionEndDate} ${election.electionEndTime}`
//         );

//         // If scheduled and time reached → set to running
//         if (election.status === "scheduled" && now.isAfter(startTime)) {
//           election.status = "running";
//           await election.save();
//           console.log(`🚀 Election "${election.electionType}" is now RUNNING`);
//         }

//         // If running and end time passed → set to completed
//         if (election.status === "running" && now.isAfter(endTime)) {
//           election.status = "completed";
//           await election.save();
//           console.log(`🏁 Election "${election.electionType}" is COMPLETED`);
//         }
//       }
//     } catch (error) {
//       console.error("❌ Scheduler error:", error);
//     }
//   });
// }

// module.exports = createElectionCtrl;

//^^^^^^^^^^^^^^^^^^^^^

// const cron = require("node-cron");
// const dayjs = require("dayjs");
// const createElectionTable = require("../models/createElectionModel");

// // 🕒 Convert delay string (like "10min", "1h", "24h") to milliseconds
// function convertDelayToMs(delay) {
//   if (!delay) return 0;
//   const num = parseInt(delay);
//   if (delay.includes("min")) return num * 60 * 1000;
//   if (delay.includes("h")) return num * 60 * 60 * 1000;
//   return 0;
// }

// // 🧩 Controller
// const createElectionCtrl = {
//   createElectionData: async (req, res) => {
//     try {
//       const {
//         electionType,
//         nominationStartDate,
//         nominationStartTime,
//         nominationEndDate,
//         nominationEndTime,
//         delayBeforeStart,
//         electionStartDate,
//         electionStartTime,
//         electionEndDate,
//         electionEndTime,
//       } = req.body;

//       // Save to MongoDB
//       const newElection = new createElectionTable({
//         electionType,
//         nominationStartDate,
//         nominationStartTime,
//         nominationEndDate,
//         nominationEndTime,
//         delayBeforeStart,
//         electionStartDate,
//         electionStartTime,
//         electionEndDate,
//         electionEndTime,
//       });

//       await newElection.save();
//       console.log("✅ Election saved to MongoDB:", newElection._id);

//       // Start cron if not already
//       if (!global.electionSchedulerStarted) {
//         startElectionScheduler();
//         global.electionSchedulerStarted = true;
//       }

//       res.json({
//         success: true,
//         message: "Election created successfully and scheduled!",
//         election: newElection,
//       });
//     } catch (error) {
//       console.error("❌ Error creating election:", error);
//       res.status(500).json({
//         success: false,
//         message: "Server error while creating election",
//       });
//     }
//   },
// };

// // -----------------------------
// // 🔁 CRON JOB CONFIGURATION
// // -----------------------------
// function startElectionScheduler() {
//   console.log("🕒 Scheduler started: checking every 30 seconds...");

//   cron.schedule("*/30 * * * * *", async () => {
//     try {
//       const now = dayjs();
//       const elections = await createElectionTable.find();

//       for (const election of elections) {
//         const baseStart = dayjs(
//           `${election.electionStartDate} ${election.electionStartTime}`
//         );
//         const baseEnd = dayjs(
//           `${election.electionEndDate} ${election.electionEndTime}`
//         );

//         // 🧮 Apply delayBeforeStart
//         const delayMs = convertDelayToMs(election.delayBeforeStart);
//         const delayedStart = baseStart.add(delayMs, "millisecond");

//         // 🚀 Move from "scheduled" → "running" after delayBeforeStart
//         if (election.status === "scheduled" && now.isAfter(delayedStart)) {
//           election.status = "running";
//           await election.save();
//           console.log(`🚀 Election "${election.electionType}" is now RUNNING`);
//         }

//         // 🏁 Move from "running" → "completed" after end time
//         if (election.status === "running" && now.isAfter(baseEnd)) {
//           election.status = "completed";
//           await election.save();
//           console.log(`🏁 Election "${election.electionType}" is COMPLETED`);
//         }
//       }
//     } catch (error) {
//       console.error("❌ Scheduler error:", error);
//     }
//   });
// }

// module.exports = createElectionCtrl;

// *****************************************

// const cron = require("node-cron");
// const dayjs = require("dayjs");
// const createElectionTable = require("../models/createElectionModel");

// // Convert delay string like "10min", "1h" to milliseconds
// function convertDelayToMs(delay) {
//   if (!delay) return 0;
//   const num = parseInt(delay);
//   if (delay.includes("min")) return num * 60 * 1000;
//   if (delay.includes("h")) return num * 60 * 60 * 1000;
//   return 0;
// }

// // ---------------------------
// // 🧩 Create Election Controller
// // ---------------------------
// const createElectionCtrl = {
//   createElectionData: async (req, res) => {
//     try {
//       const {
//         electionType,
//         nominationStartDate,
//         nominationStartTime,
//         nominationEndDate,
//         nominationEndTime,
//         delayBeforeStart,
//         electionStartDate,
//         electionStartTime,
//         electionEndDate,
//         electionEndTime,
//       } = req.body;

//       // Combine date + time into full ISO datetime strings
//       const nominationStartAt = dayjs(
//         `${nominationStartDate} ${nominationStartTime}`
//       ).toDate();
//       const nominationEndAt = dayjs(
//         `${nominationEndDate} ${nominationEndTime}`
//       ).toDate();
//       const electionStartAt = dayjs(
//         `${electionStartDate} ${electionStartTime}`
//       ).toDate();
//       const electionEndAt = dayjs(
//         `${electionEndDate} ${electionEndTime}`
//       ).toDate();

//     const newElection = new createElectionTable({
//         electionType,
//         nominationStartAt,
//         nominationEndAt,
//         delayBeforeStart,
//         electionStartAt,
//         electionEndAt,
//       });

//       await newElection.save();
//       console.log("✅ Election saved to MongoDB:", newElection._id);

//       // Start the scheduler (only once)
//       if (!global.electionSchedulerStarted) {
//         startElectionScheduler();
//         global.electionSchedulerStarted = true;
//       }

//       res.json({
//         success: true,
//         message: "Election created successfully and scheduled!",
//         election: newElection,
//       });
//     } catch (error) {
//       console.error("❌ Error creating election:", error);
//       res.status(500).json({ success: false, message: "Server error" });
//     }
//   },
// };

// // ---------------------------
// // 🕒 Scheduler (runs every 30s)
// // ---------------------------
// function startElectionScheduler() {
//   console.log("🕒 Scheduler started: checking every 30 seconds...");

//   cron.schedule("*/30 * * * * *", async () => {
//     try {
//       const now = dayjs();
//       const elections = await createElectionTable.find();

//       for (const election of elections) {
//         const startTime = dayjs(election.electionStartAt);
//         const endTime = dayjs(election.electionEndAt);
//         const delayMs = convertDelayToMs(election.delayBeforeStart);
//         const delayedStart = startTime.add(delayMs, "millisecond");

//         // "scheduled" → "running"
//         if (election.status === "scheduled" && now.isAfter(delayedStart)) {
//           election.status = "running";
//           await election.save();
//           console.log(`🚀 Election "${election.electionType}" is now RUNNING`);
//         }

//         // "running" → "completed"
//         if (election.status === "running" && now.isAfter(endTime)) {
//           election.status = "completed";
//           await election.save();
//           console.log(`🏁 Election "${election.electionType}" is COMPLETED`);
//         }
//       }
//     } catch (err) {
//       console.error("❌ Scheduler error:", err);
//     }
//   });
// }

// module.exports = createElectionCtrl;

// __________end the code for Create election controlers___________


// // ---Clear the Redis and Mongo----

// const redisClient = require("../config/redis");
// const addMemberTable = require("../models/addMemberModel");

// let decrypted_Vote = [];
// let processingLock = false;

// const ELECTION_ID = "2025_president";

// const electionClearController = {
//   clearElectionData: async (req, res) => {
//     try {
//       console.log("🧹 Starting full election reset...");

//       const deleteByPattern = async (pattern) => {
//         let cursor = "0";

//         do {
//           const reply = await redisClient.scan(
//             cursor,
//             "MATCH",
//             pattern,
//             "COUNT",
//             100
//           );

//           // Normalize
//           let newCursor = Array.isArray(reply) ? reply[0] : reply.cursor;
//           cursor = newCursor;

//           let keys = Array.isArray(reply) ? reply[1] || [] : reply.keys || [];

//           if (keys.length > 0) {
//             // 🔥 FIX: Delete keys one-by-one (works 100% always)
//             await Promise.all(keys.map((key) => redisClient.del(key)));
//             console.log(`🚮 Deleted ${keys.length} keys for ${pattern}`);
//           }
//         } while (cursor !== "0");
//       };

//       // Delete Redis keys
//       await deleteByPattern(`Votes:${ELECTION_ID}:*`);
//       await deleteByPattern(`RejectedVotes:${ELECTION_ID}:*`);
//       await deleteByPattern(`voterRandomBits:*`);

//       // Clear memory
//       decrypted_Vote = [];
//       processingLock = false;

//       // Clear MongoDB
//       await addMemberTable.deleteMany({});
//       console.log("🗑️ MongoDB addmembers cleared");

//       return res.status(200).json({
//         success: true,
//         message: "Election data fully cleared (Redis + MongoDB + memory).",
//       });
//     } catch (err) {
//       console.error("❌ Error clearing election:", err);
//       return res.status(500).json({
//         success: false,
//         message: "Error clearing election data.",
//       });
//     }
//   },
// };

// module.exports = electionClearController;