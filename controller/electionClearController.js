

const addMemberTable = require("../models/addMemberModel");

const electionClearController = {
clearElectionData: async (req, res) => {
try {
console.log(" Starting MongoDB-only election reset...");

  // Clear only MongoDB collection
  const deletedCount = await addMemberTable.deleteMany({});
  console.log(` MongoDB addmembers cleared: ${deletedCount.deletedCount} documents removed`);

  return res.status(200).json({
    success: true,
    message: "MongoDB addMemberTable cleared successfully.",
  });
} catch (err) {
  console.error("❌ Error clearing MongoDB addMemberTable:", err);
  return res.status(500).json({
    success: false,
    message: "Error clearing MongoDB addMemberTable.",
  });
}


},
};

module.exports = electionClearController;

