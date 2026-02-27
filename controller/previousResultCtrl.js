
// allow  to read local files
const fs = require("fs");
// safely build file paths
const path = require("path");

// Controller Object
const previousResultCtrl = {
  // GET /api/results/:year
  getPreviousResults: async (req, res) => {
    try {
      const { year } = req.params;

      //  Build file path dynamically
      const filePath = path.join(__dirname, "../data", `${year}_votes.json`);

      //  Check if the file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: `No data found for year ${year}` });
      }

      //  Read and parse the JSON file
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const votes = JSON.parse(fileContent); // ["11001101:Nipuna", "11001110:Kosala", ...]

      //  Initialize a map to count votes
      const voteCount = {};
      let totalVotes = 0;

      for (const vote of votes) {
        if (typeof vote === "string" && vote.includes(":")) {
          const [binaryCode, candidateNameRaw] = vote.split(":");
          const candidateName = candidateNameRaw.trim();

          // Skip invalid 16-bit binary formats
          if (!/^[01]{16}$/.test(binaryCode)) continue;

          voteCount[candidateName] = (voteCount[candidateName] || 0) + 1;
          totalVotes++;
        }
      }

      //  Convert map to structured array
      const candidates = Object.entries(voteCount).map(([name, votes]) => ({
        name,
        votes,
        percentage: ((votes / totalVotes) * 100).toFixed(1),
      }));

      //  Find the winner (highest vote count)
      const sortedCandidates = candidates.sort((a, b) => b.votes - a.votes);
      const winner = sortedCandidates.length > 0 ? sortedCandidates[0].name : null;

      //  Prepare the final response
      const result = {
        year: parseInt(year),
        totalVotes,
        candidates: sortedCandidates,
        winner,
      };

      // Send response
      return res.status(200).json(result);
    } catch (err) {
      console.error("❌ Error in getPreviousResults:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },
};

module.exports = previousResultCtrl;
