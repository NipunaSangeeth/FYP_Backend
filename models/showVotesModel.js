const mongoose = require("mongoose");

const showVoteSchema = new mongoose.Schema({
  vote_1: String,
  vote_2: String,
  vote_3: String,
  vote_4: String,
});

const showVoteTable = mongoose.model("showVotes", showVoteSchema);

module.exports = showVoteTable;
