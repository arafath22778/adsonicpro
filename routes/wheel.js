const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

// ✅ GET spin limit
router.get('/spin', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const today = new Date().toISOString().split('T')[0];
  const totalSpins = user.packages.reduce((sum, p) => sum + (p.spinsPerDay || 1), 0); // 300=1, 500=2, etc.

  user.spinHistory = user.spinHistory || {};
  const usedSpins = user.spinHistory[today] || 0;
  const spinsLeft = Math.max(0, totalSpins - usedSpins);

  res.json({ spinsLeft });
});

// ✅ POST spin reward
router.post('/reward', authMiddleware, async (req, res) => {
  const { amount } = req.body;
  const user = await User.findById(req.user.userId);
  if (!user) return res.status(404).send("User not found");

  user.balance += Number(amount);
  await user.save();

  res.send("Reward added successfully");
});

// ✅ POST spin used
router.post('/spin', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user) return res.status(404).send("User not found");

  const today = new Date().toISOString().split('T')[0];
  const totalSpins = user.packages.reduce((sum, p) => sum + (p.spinsPerDay || 1), 0);

  user.spinHistory = user.spinHistory || {};
  const usedSpins = user.spinHistory[today] || 0;

  if (usedSpins >= totalSpins) {
    return res.status(400).json({ message: "No spins left" });
  }

  user.spinHistory[today] = usedSpins + 1;
  user.markModified('spinHistory');
  await user.save();

  // reward calculation randomly (same logic from frontend can be reused)
  const rewards = ["", "2", "", "3", "", "4", "", "8", "", "9", "", ""];
  const index = Math.floor(Math.random() * rewards.length);
  const reward = rewards[index] ? parseInt(rewards[index]) : 0;

  if (reward > 0) {
    user.balance += reward;
    await user.save();
  }

  res.json({ reward });
});

module.exports = router;