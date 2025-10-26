const mongoose = require("mongoose");

const addMemberSchema = new mongoose.Schema({
  member_name: String,
  nic: String,
  dob: String,
  gender: String,
  distric: String,
  finger_print: String,
});

const addMemberTable = mongoose.model("addmember", addMemberSchema);

module.exports = addMemberTable;
