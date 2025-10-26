// Create Schema For MongoDB
const mongoose = require("mongoose");

const addCandidateSisElecSchema = new mongoose.Schema({
  sis_name: String,
  sis_regnumber: String,
  sis_batch: String,
  sis_faculty: String,
  sis_position: String,
  sis_image: String,
});

const addCandidateSisElecTable = mongoose.model(
  "addCandidatesSisElec",
  addCandidateSisElecSchema
);

module.exports = addCandidateSisElecTable;
