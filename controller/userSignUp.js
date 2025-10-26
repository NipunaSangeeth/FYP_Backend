const userModel = require("../models/userModels");
const router = require("../routes");

const bcrypt = require("bcryptjs");

const manageSignUpCtrl = {
  userSignUpData: async (req, res) => {
    try {
      console.log("Received Data:", req.body);

      const { email, password } = req.body;

      const user = await userModel.findOne({ email });

      console.log("user", user);

      //console.log("req.body", req.body);

      if (user) {
        throw new Error("Already user exits");
      }

      if (!email) {
        throw new Error("Please Provide Email");
      }

      if (!password) {
        throw new Error("Please provide Password");
      }

      const salt = bcrypt.genSaltSync(10);
      //const hashpassword = await bcrypt.hashSync("password", salt);
      const hashpassword = await bcrypt.hashSync(password, salt);

      if (!hashpassword) {
        throw new error("Something is wrong");
      }

      const payload = {
        ...req.body,
        password: hashpassword,
      };

      const userData = new userModel(payload);
      const saveUser = userData.save();

      res.status(201).json({
        data: saveUser,
        success: true,
        error: false,
        message: "User Created Successfully",
      });
    } catch (err) {
      res.json({
        message: err.message || err,
        errro: true,
        success: false,
      });
    }
  },
};

module.exports = manageSignUpCtrl;
