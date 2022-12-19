"use strict";

const transaction = require("../models/transaction");

const mongoose = require("mongoose"),
  User = mongoose.model("user"),
  Transaction = mongoose.model("transaction"),
  session = mongoose.startSession,
  jwt = require("jsonwebtoken"),
  auth = require("../middleware/auth"),
  bcrypt = require("bcrypt");
const randomstring = require("randomstring");
const nodemailer = require("nodemailer");
// const Joi = require("joi");
const user = require("../models/user");

exports.get_all_users = function (req, res) {
  User.find({}, function (err, user) {
    if (err) res.send(err);
    res.json(user);
  });
};
exports.get_user_balance = function (req, res) {
  User.findById(req.params.Id, function (err, user) {
    if (err)
      res.status(404).send(`User with Id ${Id} does not exist in the database`);
    res.json(
      `The account balance of ${user.fullName} is ${user.accountBalance}`
    );
  });
};

exports.get_transaction_history = function (req, res) {
  Transaction.find(
    { accountNumber: req.params.accountNumber },
    function (err, transaction) {
      if (err)
        res
          .status(404)
          .send(`User with account number ${accountNumber} does not exist`);
      res.json(transaction);
    }
  );
};

exports.find_user_byId = function (req, res) {
  User.findById(req.params.accountNumber, function (err, user) {
    if (err) res.status(404).send("User Does not exist in the database");
    res.json(user);
  });
};

exports.register_a_user = async function (req, res) {
  try {
    console.log("Step 1");
    // Get user input
    const { fullName, email, password, accountNumber, accountBalance } =
      req.body;

    // Validate user input
    if (!(fullName && email && password && accountBalance)) {
      res.status(400).send("All input is required");
    }
    console.log("Step 2");
    const oldUser = await User.findOne({ email });

    if (oldUser) {
      return res.status(409).send("User Already Exist. Please Login");
    }
    console.log("Step 3");

    let encryptedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      fullName,
      email: email.toLowerCase(),
      password: encryptedPassword,
      accountNumber,
      accountBalance,
    });
    console.log("Step 4");
    // Create token
    const token = jwt.sign(
      { user_id: user._id, email },
      process.env.TOKEN_KEY,
      {
        expiresIn: "2h",
      }
    );
    // save user token
    user.token = token;
    console.log("Step 5");
    // return new user
    res.status(201).json(user);
  } catch (err) {
    console.log("error in register user!");
    return res.json({ message: err });
  }
};

exports.login_a_user = async function (req, res) {
  try {
    const { email, password } = req.body;

    if (!(email && password)) {
      res.status(400).send("All input is required");
    }
    console.log("step11");
    const user = await User.findOne({ email });
    console.log("step12");
    if (
      user === null ||
      (await bcrypt.compare(password, user.password)) === false
    ) {
      res.status(400).send("Invalid Credentials");
    }
    console.log("step13");
    if (user && (await bcrypt.compare(password, user.password))) {
      const token = jwt.sign(
        { user_id: user._id, email },
        process.env.TOKEN_KEY,
        {
          expiresIn: "2h",
        }
      );
      req.user = user;
      user.token = token;
      res.status(200).json(user);
    } else {
      res.status(200).json({ msg: "password not match!" });
    }
  } catch (err) {
    console.log("err", err);
    res.json({ message: err });
  }
};

exports.change_Password = async function (req, res) {
  try {
    const { email, password, newPassword, newPassConfirm } = req.body;
    if (!(email && password && newPassword && newPassConfirm)) {
      res.status(400).send("All input are required");
    }
    const user = await User.findOne({ email });
    if (
      user === null ||
      (await bcrypt.compare(password, user.password)) === false
    ) {
      res.status(400).send("Invalid Credentials");
    }
    if (newPassword !== newPassConfirm) {
      res.status(400).send("New password and Password confirmation must match");
    }
    if (
      user &&
      (await bcrypt.compare(password, user.password)) &&
      newPassword === newPassConfirm
    ) {
      let encryptedPassword = await bcrypt.hash(newPassConfirm, 10);
      user.password = encryptedPassword;
      user.save();
      res.status(200).send("Password Changed Successfully");
    }
  } catch (error) {
    return res.json(err.message);
  }
};

const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "NGN",
});

exports.deposit_funds = async function (req, res) {
  try {
    const { accountNumber, depositAmount, description, from } = req.body;
    if (!(accountNumber && depositAmount && description && from)) {
      res.status(400).send("All input are required");
    }
    let user = await User.findOne({ accountNumber });
    if (user === null) {
      res
        .status(404)
        .send(`This User with account number ${accountNumber} does not exist`);
    }
    if (depositAmount < 500) {
      res.status(400).send(`Sorry, deposit amount cannot be less than 500`);
    }
    if (depositAmount >= 500) {
      user.accountBalance = user.accountBalance + depositAmount;
      let transactionDetails = {
        transactionType: "Deposit",
        accountNumber: accountNumber,
        description: description,
        sender: from,
        transactionAmount: depositAmount,
      };
      await user.save();
      await Transaction.create(transactionDetails);
      res
        .status(201)
        .send(
          `Deposit of ${formatter.format(
            depositAmount
          )} to ${accountNumber} was successful.`
        );
    }
  } catch (err) {
    return res.json(err.message);
  }
};

exports.transfer_money = async function (req, res) {
  try {
    const { accountNumber, transferAmount, description } = req.body;
    if (!(accountNumber && transferAmount && description)) {
      res.status(400).send("All input are required");
    }

    let beneficiary = await User.findOne({ accountNumber });
    if (beneficiary === null) {
      res.status(400).send("User with this account number does not exist");
    }

    let currentUser = await User.findById(req.user.user_id);
    if (transferAmount > currentUser.accountBalance && transferAmount > 0) {
      res.status(400).send("Insufficient funds to make this transfer");
    }
    if (currentUser.accountNumber === beneficiary) {
      res.status(400).send("Sorry you cannot send money to yourself");
    }

    if (currentUser.accountNumber !== beneficiary) {
      beneficiary.accountBalance = beneficiary.accountBalance + transferAmount;
      currentUser.accountBalance = currentUser.accountBalance - transferAmount;
      let transactionDetails = {
        transactionType: "Transfer",
        accountNumber: accountNumber,
        description: description,
        sender: currentUser.accountNumber,
        transactionAmount: transferAmount,
      };
      await beneficiary.save();
      await currentUser.save();
      await Transaction.create(transactionDetails);

      res
        .status(200)
        .send(
          `Transfer of ${formatter.format(
            transferAmount
          )} to ${accountNumber} was successful`
        );
    }
  } catch (err) {
    res.json(err.message);
  }
};

exports.withdraw_money = async function (req, res) {
  try {
    const { withdrawAmount } = req.body;
    if (!withdrawAmount) {
      res.status(400).send("Please input the amount you'd like to withdraw");
    }
    let currentUser = await User.findById(req.user.user_id);
    if (withdrawAmount > currentUser.accountBalance) {
      res.status(400).send("Insufficient funds to make this withdrawal");
    }
    currentUser.accountBalance = currentUser.accountBalance - withdrawAmount;
    let transactionDetails = {
      transactionType: "Withdraw",
      accountNumber: currentUser.accountNumber,
      description: `NIBSS withdrawal of ${formatter.format(withdrawAmount)}`,
      //sender: currentUser.accountNumber,
      transactionAmount: withdrawAmount,
    };
    await currentUser.save();
    await Transaction.create(transactionDetails);
    res
      .status(200)
      .send(`Withdrawal of ${formatter.format(withdrawAmount)} was successful`);
  } catch (error) {
    res.json(err.message);
  }
};

//forgot password
exports.forgotpassword = async (req, res) => {
  const email = req.body.email;
  try {
    const user = await User.findOne({ email: email });
    console.log("1");
    if (!user) {
      res.status(400).json;
    } else {
      const random = randomstring.generate();

      const data = await User.findByIdAndUpdate(
        { _id: user.id },
        { $set: { temp: random } },
        { new: true }
      );
      console.log("2");
      sendresetmail(user.email, user.fullName, random);
      res.json(data);
      console.log(data);
    }
  } catch (err) {
    res.json(err.message);
  }
};

const sendresetmail = async (name, email, temp) => {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      auth: {
        user: "devonte48@ethereal.email",
        pass: "ztN6sJ4SPfvnKnjUqc",
      },
    });

    const mailOptions = {
      from: "devonte48@ethereal.email",
      to: "wirova3970@fdsdfdfddfddfdfdfdd.com",
      subject: "Reset password",
      html:
        '<p> Hi, please click <a href="http://localhost:3000/api/resetpassword?token=' +
        temp +
        '"> here</a>',
    };

    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log("mail sent", info.response);
      }
    });
  } catch (error) {
    res.json(err.message)
  }
};

//reset
exports.resetpassword = async (req, res) => {
  try {
    const temp = req.query.token;
    const tokenData = await User.findOne({ temp: temp });
    if (!temp) {
      res.status(400).json({
        msg: "invalid token",
      });
    }

    const password = req.body.newPassword;
    const updatedPassword = await bcrypt.hash(password, 10);

    const userData = await User.findByIdAndUpdate(
      { _id: tokenData.id },
      { $set: { password: updatedPassword, temp: "" } },
      { new: true }
    );

    res.status(200).json(userData);
  } catch (error) {
    res.status(400).json({
      msg: "something went wrong",
    });
  }
};

//testing authorization
exports.auth = function (req, res) {
  res.status(200).send("Welcome to This Bank Api built with NodeJs");
};
