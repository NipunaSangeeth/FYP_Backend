//###############2025/11/07#################

// server/models/createElectionModel.js
const mongoose = require("mongoose");

const createElectionSchema = new mongoose.Schema(
  {
    electionType: { type: String, required: true }, // "president" | "sis"
    nominationStartAt: { type: Date, required: true },
    nominationEndAt: { type: Date, required: true },
    delayBeforeStart: { type: String, required: true }, // e.g. "5min", "2h"
    electionStartAt: { type: Date, required: true },
    electionEndAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["scheduled", "nomination", "waiting", "running", "completed"],
      default: "scheduled",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("createelection", createElectionSchema);
