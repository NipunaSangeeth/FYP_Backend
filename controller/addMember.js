const addMemberTable = require("../models/addMemberModel");

const router = require("../routes");

const manageMemberCtrl = {
  addMemberData: async (req, res) => {
    try {
      const { member_name, nic, dob, gender, distric, finger_print } = req.body;

      const newMember = new addMemberTable({
        member_name,
        nic,
        dob,
        gender,
        distric,
        finger_print,
      });

      await newMember.save();

      res.json({ msg: "Member Added" });
    } catch (error) {
      console.log("error", error);
    }
  },

  getMember: async (req, res) => {
    try {
      let addMemberTables = await addMemberTable.find();
      console.log("All MembersData Fetched");
      res.send(addMemberTables);
      console.log("success", addMemberTables);
    } catch (error) {
      console.log("Not Fetch data", err);
      res.status(400).json({
        message: err.message || err,
        error: true,
        success: false,
      });
    }
  },

  // deleteAllMembers:async(req, res) =>{
  //  try {
  //     await addMemberTable.deleteMany({});
  //     console.log("All addmembers deleted successfully.");

  //     return res.status(200).json({
  //       message: "All members deleted successfully",
  //     });
  //   } catch (error) {
  //     console.error("❌ Failed to delete members:", error);
  //     return res.status(500).json({
  //       message: "Failed to delete members",
  //     });
  //   }
  // },
};
module.exports = manageMemberCtrl;
