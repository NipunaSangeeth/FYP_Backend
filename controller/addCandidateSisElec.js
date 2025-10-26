const addCandidateSisElecTable = require("../models/addCandidatesSisElecModel");

const manageCandidateSisElecCtrl = {
  addCandidateSisElecData: async (req, res) => {
    try {
      const {
        sis_name,
        sis_regnumber,
        sis_batch,
        sis_faculty,
        sis_position,
        sis_image,
      } = req.body;

      // check the Registration number is already exits
      const existingCandidate = await addCandidateSisElecTable.findOne({
        sis_regnumber: sis_regnumber,
      });

      if (existingCandidate) {
        return res.status(400).json({
          success: false,
          message:
            "This Registration Number already exists. Please use a different one.",
        });
      }

      const newCandidateSisElec = new addCandidateSisElecTable({
        sis_name,
        sis_regnumber,
        sis_batch,
        sis_faculty,
        sis_position,
        sis_image,
      });
      await newCandidateSisElec.save();

      res.json({ msg: "SIS Candidate Added Done" });
    } catch (error) {
      console.log("error", error);
    }
  },

  getCandidateSisElec: async (req, res) => {
    try {
      let addCandidateSisElecTables = await addCandidateSisElecTable.find();
      console.log("All SIS Candidates data fetched");
      res.send(addCandidateSisElecTables);
      console.log("success", addCandidateSisElecTable);
    } catch (error) {
      console.log("Not Fetch data", error);
      res.status(400).json({
        message: error.message || error,
        error: true,
        success: false,
      });
    }
  },
};

module.exports = manageCandidateSisElecCtrl;
