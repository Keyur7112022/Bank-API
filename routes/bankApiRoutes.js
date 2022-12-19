"use strict";

const auth = require("../middleware/auth");

module.exports = function (app) {
  const bankApi = require("../controllers/userController");

  app.route("/api/register").post(bankApi.register_a_user);

  app.route("/api/transfer").post(auth, bankApi.transfer_money);

  app.route("/api/withdraw").post(auth, bankApi.withdraw_money);

  app.route("/api/users").get(bankApi.get_all_users);

  app
    .route("/api/transaction/:accountNumber")
    .get(auth, bankApi.get_transaction_history);

  app.route("/api/balance/:Id").get(auth, bankApi.get_user_balance);

  app.route("/api/change_Password").put(bankApi.change_Password);

  app.route("/api/user/:accountNumber").get(auth, bankApi.find_user_byId);

  app.route("/api/login").post(bankApi.login_a_user);

  app.route("/api/welcome").post(auth, bankApi.auth);

  app.route("/api/deposit").post(auth, bankApi.deposit_funds);

  app.route("/api/forgotpassword").post(bankApi.forgotpassword);

  app.route("/api/resetpassword").post(bankApi.resetpassword);
};
