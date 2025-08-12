const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  date: {
    type: String, // Format: "2025-08-07"
    required: true
  },
  completedTasks: {
    type: Number,
    default: 0
  }
});

module.exports = mongoose.model("Task", taskSchema);