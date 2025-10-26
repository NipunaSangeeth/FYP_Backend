const addMemberSisTable = require("../models/addMemberSisElecModel");
// SisMember is the SIS Election Voters
const router = require("../routes");

const manageSisMemberCtrl = {
  addSismemberData: async (req, res) => {
    try {
      const {
        student_name,
        register_number,
        batch,
        faculty,
        sis_finger_print,
      } = req.body;

      const newSisMember = new addMemberSisTable({
        student_name,
        register_number,
        batch,
        faculty,
        sis_finger_print,
      });

      await newSisMember.save();

      res.json({ msg: "SIS Election Voter Added Done" });
    } catch (error) {
      console.log("error", error);
    }
  },

  getSisMemberElec: async (req, res) => {
    try {
      let addMemberSisTables = await addMemberSisTable.find();
      console.log("All SIS Voter members data fetched");

      res.send(addMemberSisTables);
      console.log("Success...", addMemberSisTable);
    } catch (error) {
      console.log("Not Fetch data", err);
      res.status(400).json({
        message: err.message || err,
        error: true,
        success: false,
      });
    }
  },
};

module.exports = manageSisMemberCtrl;
