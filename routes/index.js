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

// for the Rejected Votes 
router.get(
  "/rejected-vote-counts",
  managerejectedVoteCtrl.getRejectedVoteCount
);

// for Get the Votes
router.get("/results/:year",previousResultCtrl.getPreviousResults)

module.exports = router;
