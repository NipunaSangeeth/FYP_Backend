const addCandidateTable = require("../models/addCandidatesModel");

const router = require("../routes");

const manageCandidateCtrl = {
  addCandidateData: async (req, res) => {
    try {
      const {
        candidate_name,
        candidate_nic,
        candidate_dob,
        candidate_district,
        candidate_party,
        candidate_simbol,
        candidate_number,
        candidate_image,
      } = req.body;

      const newCandidate = new addCandidateTable({
        candidate_name,
        candidate_nic,
        candidate_dob,
        candidate_district,
        candidate_party,
        candidate_simbol,
        candidate_number,
        candidate_image,
      });

      await newCandidate.save();

      res.json({ msg: "Canddate added Done" });
    } catch (error) {
      console.log("error", error);
    }
  },

  getcandidate: async (req, res) => {
    try {
      let addCandidateTables = await addCandidateTable.find();
      console.log("All Candidates data fetched");
      res.send(addCandidateTables);
      console.log("success", addCandidateTable);
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

module.exports = manageCandidateCtrl;
