const express = require("express");
const router = express.Router();
const Task = require("../models/Task");
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");
const moment = require("moment");

// ইউজারের প্রতিদিনের Task Info
router.get("/info", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const date = moment().format("YYYY-MM-DD");

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const packageAmount = user.packageAmount;
  let maxTasks = 0;
  if (packageAmount === 300) maxTasks = 1;
  else if (packageAmount === 500) maxTasks = 2;
  else if (packageAmount === 1000) maxTasks = 3;

  let task = await Task.findOne({ userId, date });
  if (!task) {
    task = await Task.create({ userId, date, completedTasks: 0 });
  }

  res.json({
    maxTasks,
    completedTasks: task.completedTasks
  });
});

// ইউজার Task Complete করল
router.post("/complete", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const date = moment().format("YYYY-MM-DD");

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const packageAmount = user.packageAmount;
  let maxTasks = 0;
  if (packageAmount === 300) maxTasks = 1;
  else if (packageAmount === 500) maxTasks = 2;
  else if (packageAmount === 1000) maxTasks = 3;

  const task = await Task.findOne({ userId, date });

  if (task.completedTasks >= maxTasks) {
    return res.status(400).json({ error: "Daily task limit reached." });
  }

  task.completedTasks += 1;
  await task.save();

  // ইউজারের ব্যালেন্স বাড়ান
  user.balance += 5; // প্রতি Task 5 টাকা
  await user.save();

  res.json({ success: true, balance: user.balance });
});

module.exports = router;