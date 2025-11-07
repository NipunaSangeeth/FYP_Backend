//#############################__2025/11/07__########################################

const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const cron = require("node-cron");
const CreateElection = require("../models/createElectionModel");

dayjs.extend(utc);
dayjs.extend(timezone);
const TZ = "Asia/Colombo";

// Global reference to active cron job
let activeCronJob = null;

// Helper: convert delay string like "5min" or "2h" to minutes
function delayStrToMinutes(delayStr) {
  if (!delayStr) return 0;
  if (typeof delayStr === "number") return delayStr;
  const s = String(delayStr).toLowerCase();
  if (s.endsWith("min")) return parseInt(s.replace("min", ""), 10);
  if (s.endsWith("h")) return parseInt(s.replace("h", ""), 10) * 60;
  if (s.endsWith("d")) return parseInt(s.replace(/\D/g, ""), 10) * 1440;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? 0 : n;
}

// Scheduler function
async function startScheduler() {
  if (activeCronJob) {
    try {
      activeCronJob.stop();
    } catch (e) {}
    activeCronJob = null;
  }

  activeCronJob = cron.schedule("*/30 * * * * *", async () => {
    try {
      const election = await CreateElection.findOne()
        .sort({ createdAt: -1 })
        .lean();
      if (!election) return;

      const now = dayjs().tz(TZ);
      const ns = dayjs(election.nominationStartAt).tz(TZ);
      const ne = dayjs(election.nominationEndAt).tz(TZ);
      const es = dayjs(election.electionStartAt).tz(TZ);
      const ee = dayjs(election.electionEndAt).tz(TZ);

      if (now.isAfter(ns) && now.isBefore(ne)) {
        const doc = await CreateElection.findById(election._id);
        if (doc && doc.status !== "nomination") {
          doc.status = "nomination";
          await doc.save();
          console.log(`📢 Nomination period for "${doc.electionType}" started`);
        }
        return;
      }

      if (now.isAfter(ne) && now.isBefore(es)) {
        const minutesLeft = es.diff(now, "minute");
        const doc = await CreateElection.findById(election._id);
        if (doc && doc.status !== "waiting") {
          doc.status = "waiting";
          await doc.save();
          console.log(`Nomination time Ended..`);
        }
        console.log(
          `[countdown] - Only ${minutesLeft} minute(s) left to start...`
        );
        return;
      }

      if (now.isAfter(es) && now.isBefore(ee)) {
        const doc = await CreateElection.findById(election._id);
        if (doc && doc.status !== "running") {
          doc.status = "running";
          await doc.save();
          console.log(`🚀 Election "${doc.electionType}" is now RUNNING`);
        }
        return;
      }

      if (now.isAfter(ee) || now.isSame(ee)) {
        const doc = await CreateElection.findById(election._id);
        if (doc && doc.status !== "completed") {
          doc.status = "completed";
          await doc.save();
          console.log(`🏁 Election "${doc.electionType}" is COMPLETED`);
        }
        return;
      }
    } catch (err) {
      console.error("Scheduler error:", err);
    }
  });

  activeCronJob.start();
}

// 🧩 Controller object (correct export structure)
const createElectionCtrl = {
  // === Create Election ===
  createElection: async (req, res) => {
    try {
      const {
        electionType,
        nominationStartAt,
        nominationEndAt,
        delayBeforeStart,
        electionStartAt,
        electionEndAt,
      } = req.body;

      if (
        !electionType ||
        !nominationStartAt ||
        !nominationEndAt ||
        !delayBeforeStart ||
        !electionStartAt ||
        !electionEndAt
      ) {
        return res
          .status(400)
          .json({ success: false, message: "All fields are required." });
      }

      const ns = dayjs(nominationStartAt).tz(TZ);
      const ne = dayjs(nominationEndAt).tz(TZ);
      const es = dayjs(electionStartAt).tz(TZ);
      const ee = dayjs(electionEndAt).tz(TZ);

      if (!ne.isAfter(ns)) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Nomination end must be after start.",
          });
      }

      const delayMinutes = delayStrToMinutes(delayBeforeStart);
      const minAllowedEs = ne.add(delayMinutes, "minute");
      if (es.isBefore(minAllowedEs)) {
        return res.status(400).json({
          success: false,
          message: `Election start must be at or after ${minAllowedEs.format(
            "YYYY/MM/DD hh:mm A"
          )}.`,
        });
      }

      if (!ee.isAfter(es)) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Election end must be after election start.",
          });
      }

      // Optional: single-election mode
      await CreateElection.deleteMany({});

      const newElection = await CreateElection.create({
        electionType,
        nominationStartAt: ns.toDate(),
        nominationEndAt: ne.toDate(),
        delayBeforeStart,
        electionStartAt: es.toDate(),
        electionEndAt: ee.toDate(),
        status: "scheduled",
      });

      console.log(`✅ Election saved to MongoDB: ${newElection._id}`);
      await startScheduler();
      console.log("🕒 Scheduler started: checking every 30 seconds...");

      res.status(201).json({
        success: true,
        message: `${newElection.electionType} election created successfully.`,
        data: newElection,
      });
    } catch (err) {
      console.error("Error creating election:", err);
      res
        .status(500)
        .json({
          success: false,
          message: "Server error while creating election.",
        });
    }
  },

  // === Resume Scheduler ===
  resumeSchedulerOnStartup: async () => {
    try {
      if (activeCronJob) return;
      const election = await CreateElection.findOne()
        .sort({ createdAt: -1 })
        .lean();
      if (!election) return;
      await startScheduler();
      console.log(
        "🕒 Scheduler resumed on startup: checking every 30 seconds..."
      );
    } catch (err) {
      console.error("Error resuming scheduler on startup:", err);
    }
  },
};

module.exports = createElectionCtrl;


