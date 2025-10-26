const mongoose = require("mongoose");

const addCandidateSchema = new mongoose.Schema({
  candidate_name: String,
  candidate_nic: String,
  candidate_dob: String,
  candidate_district: String,
  candidate_party: String,
  candidate_simbol: String,
  candidate_number: String,
  candidate_image: String,
});

const addCandidateTable = mongoose.model("addcandidates", addCandidateSchema);

module.exports = addCandidateTable;
