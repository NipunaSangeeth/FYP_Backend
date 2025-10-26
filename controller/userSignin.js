const bcrypt = require("bcryptjs");
const userModel = require("../models/userModels");
const jwt = require("jsonwebtoken");

const manageSignInCtrl = {
  userSignInData: async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email) {
        throw new Error("Please Provide Email");
      }

      if (!password) {
        throw new Error("Please provide Password");
      }

      // Check the Email and password is are acailable in DB
      const user = await userModel.findOne({ email });

      if (!user) {
        throw new Error("User Is Not Register");
      }

      const CheckPassword = await bcrypt.compare(password, user.password);
      console.log("CheckPassword", CheckPassword);

      if (CheckPassword) {
        const tokenData = {
          _id: user._id,
          email: user.email,
        };
        // Token will be expire in 08H
        const token = await jwt.sign(tokenData, process.env.TOKEN_SECRET_KEY, {
          expiresIn: 60 * 60 * 8,
        });

        const tokenOption = {
          httpOnly: true,
          secure: true,
        };

        res.cookie("token", token, tokenOption).json({
          message: "Login Successfully",
          data: token,
          success: true,
          error: false,
        });
      } else {
        throw new Error("please check the password");
      }
    } catch (err) {
      res.json({
        message: err.message || err,
        errro: true,
        success: false,
      });
    }
  },
};

module.exports = manageSignInCtrl;
