const express = require("express");
const router = express.Router();

const manageMemberCtrl = require("../controller/addMember");
const manageCandidateCtrl = require("../controller/addCandidates");
const manageSignUpCtrl = require("../controller/userSignUp");
const manageSignInCtrl = require("../controller/userSignin");
const manageCandidateSisElecCtrl = require("../controller/addCandidateSisElec");
const manageSisMemberCtrl = require("../controller/addMemberSisElec");
const manageShowVoteCtrl = require("../controller/getElcVotesInDashbord");
const managerejectedVoteCtrl = require("../controller/rejectVoteCount");
const previousResultCtrl = require("../controller/previousResultCtrl");
const createElectionCtrl = require("../controller/createElectionCtrl");
const generateReportCtrl = require("../controller/generateReportCtrl");
const electionClearController = require("../controller/electionClearController");

// ~~~~~~~~~~~~~ Router For Api ~~~~~~~~~

router.post("/signup", manageSignUpCtrl.userSignUpData);

//[SignInpart]
router.post("/signin", manageSignInCtrl.userSignInData);

// ADD and GET MEMBER PART(For president Election)
router.post("/addmember", manageMemberCtrl.addMemberData);
router.get("/get-addmember", manageMemberCtrl.getMember);



// ADD and GET Member SIS Electiion part
router.post("/addvoter", manageSisMemberCtrl.addSismemberData);
router.get("/get-addvoter", manageSisMemberCtrl.getSisMemberElec);

// ADD and GET CANDIDATE PART (For president Election)
router.post("/addcandidate", manageCandidateCtrl.addCandidateData);
router.get("/get-addcandidate", manageCandidateCtrl.getcandidate);

// ADD and GET Candidates SIS Election PART
router.post(
  "/addcandidate-sis-elec",
  manageCandidateSisElecCtrl.addCandidateSisElecData
);
router.get(
  "/get-addcandidate-sis-elec",
  manageCandidateSisElecCtrl.getCandidateSisElec
);

// Get And Post Data In to the Console For DashBoard(DEMO)
router.post("/submit-vote", manageShowVoteCtrl.getshowvot);
router.get("/get-votes", manageShowVoteCtrl.getVoteCounts);

// NEW ENDPOINT FOR CLEARING REDIS And MONGODB
router.delete("/election/clear",electionClearController.clearElectionData);

// for the Rejected Votes
router.get(
  "/rejected-vote-counts",
  managerejectedVoteCtrl.getRejectedVoteCount
);

// for Get the Votes
router.get(
  "/previousresults/president/:year",
  previousResultCtrl.getPreviousResults
);

// create election.

// Health check
router.get("/", (req, res) => res.json({ success: true, message: "API ok" }));

// Create election
router.post("/create-election", createElectionCtrl.createElection);

// Get latest election (for front-end indicators)
router.get("/election-status", createElectionCtrl.getLatestElection);

// Resume scheduler on import (so server/index.js does not need to be changed)
// NOTE: calling the resume function here will run when 'require("./routes")' is executed in server/index.js
if (typeof createElectionCtrl.resumeSchedulerOnStartup === "function") {
  // call but don't await blocking the require; log errors if any
  createElectionCtrl
    .resumeSchedulerOnStartup()
    .catch((err) =>
      console.error("Error resuming scheduler from routes import:", err)
    );
}

// Generate & download final report
router.get("/generate-report", generateReportCtrl.generateReport);

module.exports = router;
