const mongoose = require("mongoose");

const addMemberSisSchema = new mongoose.Schema({
  student_name: String,
  register_number: String,
  batch: String,
  faculty: String,
  sis_finger_print: String,
});

const addMemberSisTable = mongoose.model(
  "addmembersiselec",
  addMemberSisSchema
);

module.exports = addMemberSisTable;
