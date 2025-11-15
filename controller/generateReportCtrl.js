
//__________________2025/11/16______Full Stable______________
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const Redis = require("ioredis");
const redis = new Redis();
const CreateElection = require("../models/createElectionModel");

const generateReportCtrl = {
  generateReport: async (req, res) => {
    try {
      // -----------------------------------------
      // 1. Find latest RUNNING or COMPLETED election
      // -----------------------------------------
      const latestElection = await CreateElection.findOne()
        .sort({ createdAt: -1 })
        .lean();

      if (!latestElection) {
        return res.status(404).json({
          message: "No election found. Cannot generate report.",
        });
      }

      // -----------------------------------------
      // 2. Create PDF document
      // -----------------------------------------
      const doc = new PDFDocument({ margin: 50 });

      const timestamp = Date.now();
      const fileName = `Election_Report_${timestamp}.pdf`;
      const filePath = path.join(__dirname, "../reports/", fileName);

      if (!fs.existsSync(path.join(__dirname, "../reports"))) {
        fs.mkdirSync(path.join(__dirname, "../reports"));
      }

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // -----------------------------------------
      // 3. TITLE + GENERATED TIME
      // -----------------------------------------
      doc.fontSize(22).text("Final Election Report", { align: "center" });
      doc.moveDown();
      doc.fontSize(14).text(`Generated At: ${new Date().toLocaleString()}`);
      doc.moveDown(2);

      // -----------------------------------------
      // 4. Election Details
      // -----------------------------------------
      doc.fontSize(18).text("Election Details", { underline: true });
      doc.moveDown();

      doc.fontSize(12).text(`Election Type: ${latestElection.electionType}`);
      doc.text(
        `Nomination Start: ${new Date(
          latestElection.nominationStartAt
        ).toLocaleString()}`
      );
      doc.text(
        `Nomination End: ${new Date(
          latestElection.nominationEndAt
        ).toLocaleString()}`
      );
      doc.text(
        `Election Start: ${new Date(
          latestElection.electionStartAt
        ).toLocaleString()}`
      );
      doc.text(
        `Election End: ${new Date(
          latestElection.electionEndAt
        ).toLocaleString()}`
      );

      doc.moveDown(2);

      // -----------------------------------------
      // 5. Fetch vote results from Redis
      // -----------------------------------------
      const keys = await redis.keys("Votes:*");
      let totalValidVotes = 0;

      let voteData = [];

      for (const key of keys) {
        const count = parseInt(await redis.get(key)) || 0;
        totalValidVotes += count;

        voteData.push({
          candidateKey: key.replace("Votes:", ""), // ex: 2025_president:Kasun
          votes: count,
        });
      }

      // Sort highest votes first
      voteData.sort((a, b) => b.votes - a.votes);

      // -----------------------------------------
      // 6. Vote Results Section
      // -----------------------------------------
      doc.fontSize(18).text("Vote Results", { underline: true });
      doc.moveDown();

      if (voteData.length === 0) {
        doc.fontSize(12).text("No votes found.");
      } else {
        voteData.forEach((v) => {
          const pct =
            totalValidVotes === 0
              ? "0%"
              : ((v.votes / totalValidVotes) * 100).toFixed(2) + "%";

          doc.fontSize(12).text(`${v.candidateKey}:`);
          doc.text(`  ${v.votes} votes, percentage - ${pct}`);
          doc.moveDown(0.5);
        });
      }

      doc.moveDown(1);

      // -----------------------------------------
      // 7. Successfully casted votes
      // -----------------------------------------
      doc.fontSize(14).text(
        `Successfully casted Votes: ${totalValidVotes}`,
        { underline: true }
      );
      doc.moveDown(2);

      // -----------------------------------------
      // 8. WINNER SECTION (supports multi-winners)
      // -----------------------------------------
      doc.fontSize(18).text("Winner(s)", { underline: true });
      doc.moveDown();

      if (voteData.length === 0) {
        doc.fontSize(12).text("No winner — no votes available.");
      } else {
        const highestVotes = voteData[0].votes;
        const winners = voteData.filter((v) => v.votes === highestVotes);

        winners.forEach((w) => {
          const pct =
            totalValidVotes === 0
              ? "0%"
              : ((w.votes / totalValidVotes) * 100).toFixed(2) + "%";

          doc
            .fontSize(12)
            .text(`${w.candidateKey}, Votes: ${w.votes}, Percentage: ${pct}`);
        });
      }

      doc.moveDown(2);

      // -----------------------------------------
      // 9. Rejected Votes
      // -----------------------------------------
      const rejected = await redis.get("RejectedVotes:count");

      doc.fontSize(18).text("Rejected Votes", { underline: true });
      doc.moveDown();
      doc
        .fontSize(12)
        .text(`Total Rejected Votes: ${rejected ? rejected : 0}`);

      // -----------------------------------------
      // 10. Finish PDF
      // -----------------------------------------
      doc.end();

      stream.on("finish", () => {
        res.download(filePath, fileName);
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to generate report" });
    }
  },
};

module.exports = generateReportCtrl;
