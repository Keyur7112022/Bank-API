const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: "Please enter the FullName" },
  email: { type: String, required: "Email address is required" },
  password: { type: String, required: "Password is required" },
  token: { type: String },
  accountNumber: { type: Number },
  accountBalance: {
    type: Number,
    required: "Please input the amount you would like to open an account with",
  },
  accountType: {
    type: String,
    enum: ["savings", "current"],
    default: "savings",
  },
  Id: { type: String },
  temp: { type: String, default: "" },
});

module.exports = mongoose.model("user", userSchema);
