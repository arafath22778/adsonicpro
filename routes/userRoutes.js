// routes/userRoutes.js বা নতুন ফাইলে
const express = require('express');
const router = express.Router();
const Commission = require('../models/Commission');
const authMiddleware = require('../middleware/auth');

// ইউজার কমিশন দেখার API
router.get('/commission-history', authMiddleware, async (req, res) => {
  try {
    const commissions = await Commission.find({ userId: req.user._id }).sort({ date: -1 });
    res.json(commissions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch commissions' });
  }
});

module.exports = router;