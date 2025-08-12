const mongoose = require ('mongoose');

const userSchema = new mongoose.Schema ({
  name: String,
  email: String,
  password: String,
  balance: {type: Number, default: 20},
  otp: { type: Number },
  otpExpiration: { type: Date },
  referCode: {type: String, unique: true},
  referredBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
  packages: [
    {
      id: mongoose.Schema.Types.ObjectId,
      name: String,
      adsPerDay: Number,
      boughtAt: Date,
    },
  ],
  // ✅ এই ফিল্ড দুটি server.js-এর সাথে সামঞ্জস্যপূর্ণ
  adsWatched: {
    type: Map,
    of: Number,
    default: {},
  },
  wheelHistory: {
    type: Map,
    of: Number,
    default: {},
  },
  spinHistory: {type: Map, of: Number, default: {}},
  referralBonusGiven: {type: Boolean, default: false},
  blocked: {type: Boolean, default: false},
});

userSchema.pre ('save', function (next) {
  if (!this.referCode) {
    this.referCode = this._id.toString ();
  }
  next ();
});

module.exports = mongoose.model ('User', userSchema);