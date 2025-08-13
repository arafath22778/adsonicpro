// সব মডিউল ইম্পোর্ট
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const cron = require("node-cron");
const nodemailer = require('nodemailer');
const { v2: cloudinary } = require('cloudinary');
const { Readable } = require('stream');
const crypto = require('crypto'); // নতুন: টোকেন তৈরির জন্য crypto মডিউল

// dotenv প্যাকেজ ইম্পোর্ট ও কনফিগার করা
require('dotenv').config();

// আপনার সব মডেল ইম্পোর্ট
const BonusCode = require('./models/BonusCode');
const Notification = require('./models/Notification');
const userRoutes = require('./routes/userRoutes');
const Commission = require('./models/Commission');
const wheelRoutes = require('./routes/wheel');
const authMiddleware = require('./middleware/authMiddleware');
const Package = require('./models/Package');
const User = require('./models/User');
const Deposit = require('./models/Deposit');
const Withdraw = require('./models/Withdraw');
const SupportTicket = require('./models/SupportTicket');

const app = express();

// .env থেকে ভেরিয়েবল ব্যবহার করা হচ্ছে
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET;
const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL; // নতুন: অ্যাডমিনের ইমেইল
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`; // নতুন: সার্ভারের বেস URL

// MongoDB সংযোগ
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB error:", err));

// Nodemailer ট্রান্সপোর্টার কনফিগারেশন
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
});

// Cloudinary কনফিগারেশন
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// কাস্টম Multer স্টোরেজ ইঞ্জিন
const upload = multer({
  storage: multer.memoryStorage(),
}).single('screenshot');

// একটি ফাংশন যা বাফার থেকে Cloudinary-তে ফাইল আপলোড করে।
const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const readableStream = Readable.from(buffer);
    const cloudinaryStream = cloudinary.uploader.upload_stream(
      { folder: 'deposit_screenshots', resource_type: 'auto' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    readableStream.pipe(cloudinaryStream);
  });
};

// অ্যাডমিনকে ইমেইল নোটিফিকেশন পাঠানোর জন্য ফাংশন, এখন বাটন সহ
const sendAdminNotificationEmail = async (subject, htmlContent) => {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: ADMIN_EMAIL,
      subject: subject,
      html: htmlContent
    };
 
    try {
      await transporter.sendMail(mailOptions);
      console.log('Admin notification email sent successfully.');
    } catch (error) {
      console.error('Error sending admin notification email:', error);
    }
};

// দৈনিক বিজ্ঞাপন দেখার সীমা রিসেট করার জন্য cron job
cron.schedule("0 0 * * *", async () => {
  const today = new Date().toISOString().split("T")[0];
  await User.updateMany({}, { $unset: { [`adsWatched.${today}`]: "" } });
  console.log("🕛 Ads reset for all users at midnight.");
});

// OTP ইমেলের জন্য টেমপ্লেট
const emailTemplate = (otp) => {
  return `
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
    <html xmlns="http://www.w3.org/1999/xhtml">
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
      <title>Clickora - রেজিস্ট্রেশন OTP</title>
      <style type="text/css">
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; font-size: 16px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.05); }
        .header { background-color: #3498db; padding: 30px; text-align: center; border-top-left-radius: 8px; border-top-right-radius: 8px; }
        .header img { max-width: 150px; }
        .content { padding: 40px; text-align: center; color: #333333; }
        .greeting { font-size: 20px; font-weight: 600; margin-bottom: 20px; }
        .message { font-size: 16px; line-height: 1.6; margin-bottom: 30px; }
        .otp-box-container { text-align: center; margin-bottom: 30px; }
        .otp-box {
            display: inline-block;
            background-color: #ecf0f1;
            border-radius: 6px;
            padding: 15px 30px;
            font-size: 32px;
            font-weight: bold;
            color: #2c3e50;
            letter-spacing: 5px;
            border: 2px dashed #95a5a6;
        }
        .instruction { font-size: 14px; color: #7f8c8d; margin-top: 10px; }
        .footer { padding: 20px; text-align: center; border-top: 1px solid #eeeeee; color: #95a5a6; font-size: 12px; }
        .footer a { color: #3498db; text-decoration: none; }
        @media only screen and (max-width: 600px) {
            .container { width: 100% !important; margin: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
            .content { padding: 20px !important; }
            .otp-box { font-size: 28px !important; }
        }
      </style>
    </head>
    <body>
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td align="center" style="padding: 20px;">
            <table class="container" border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td class="header">
                  <img src="https://ik.imagekit.io/ubdzcqpss/Lucid_Realism_A_sleek_modern_and_professional_logo_design_for__3-removebg-preview.png?updatedAt=1754931110372" alt="Clickora Logo" width="150" style="display:block;">
                </td>
              </tr>
              <tr>
                <td class="content">
                  <p class="greeting">প্রিয় ব্যবহারকারী,</p>
                  <p class="message">Adsonicpro-তে নিবন্ধন করার জন্য আপনাকে ধন্যবাদ। আপনার রেজিস্ট্রেশন সম্পন্ন করতে নিচের ওয়ান-টাইম পাসওয়ার্ড (OTP) ব্যবহার করুন। নিরাপত্তার জন্য, এই কোডটি শুধুমাত্র ৫ মিনিটের জন্য বৈধ।</p>
                  
                  <div class="otp-box-container">
                    <span class="otp-box">${otp}</span>
                  </div>
                  
                  <p class="instruction">
                    এই OTP কোডটি কপি করতে কোডের উপর ট্যাপ করে সিলেক্ট করুন।
                  </p>
                  <p class="instruction" style="font-weight: bold; color: #e74c3c;">
                    ⚠️ দ্রষ্টব্য: নিরাপত্তার কারণে, এই ইমেলের মধ্যে কোনো বাটন কাজ করবে না।
                  </p>
                </td>
              </tr>
              <tr>
                <td class="footer">
                  <p>&copy; ${new Date().getFullYear()} Adsonicpro. সকল স্বত্ব সংরক্ষিত।</p>
                  <p style="margin-top: 5px;">
                    যদি আপনি এই ইমেলটি না পাঠিয়ে থাকেন, তাহলে দয়া করে এটি উপেক্ষা করুন।
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

// নতুন স্বাগতম ইমেলের জন্য টেমপ্লেট
const welcomeEmailTemplate = (name, bonusCode) => {
  return `
    <!DOCTYPE html>
    <html lang="bn">
    <head>
      <meta charset="UTF-8">
      <title>স্বাগতম Adsonicpro-তে!</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.05); overflow: hidden; }
        .header { background-color: #28a745; color: #ffffff; padding: 30px; text-align: center; }
        .content { padding: 40px; text-align: center; color: #333333; }
        .bonus-box { background-color: #fff3cd; border: 1px solid #ffeeba; border-radius: 6px; padding: 15px; margin: 20px 0; display: inline-block; }
        .bonus-code { font-size: 24px; font-weight: bold; color: #856404; }
        .footer { padding: 20px; text-align: center; border-top: 1px solid #eeeeee; color: #999; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>স্বাগতম, ${name}!</h1>
        </div>
        <div class="content">
          <p>Adsonicpro পরিবারের অংশ হওয়ার জন্য আপনাকে অভিনন্দন। আপনার অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে।</p>
          <p>আপনার প্রথম ডিপোজিটে একটি বিশেষ বোনাস পেতে নিচের কোডটি ব্যবহার করুন।এই কোডটি ব্যবহার করলে আপনি সাথে সাথে ৫০ টাকা বোনাস পাবেন।</p>
          <div class="bonus-box">
            <p style="margin: 0;">আপনার বোনাস কোড:</p>
            <span class="bonus-code">${bonusCode}</span>
          </div>
          <p>শুভকামনা!</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Adsonicpro. সর্বস্বত্ব সংরক্ষিত।</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// মিডলওয়্যার এবং রুট
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use(express.static('views'));
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// সব API রুট
app.use('/api', userRoutes);
app.use('/api/wheel', wheelRoutes);

const sendView = (view) => (req, res) => res.sendFile(path.join(__dirname, 'views', view));
app.get('/', sendView('index.html'));
app.get('/login', sendView('index.html'));
app.get('/register', sendView('register.html'));
app.get('/dashboard', sendView('dashboard.html'));
app.get('/deposit', sendView('deposit.html'));
app.get('/withdraw', sendView('withdraw.html'));
app.get('/withdraw-history', sendView('withdraw-history.html'));
app.get('/deposit-history', sendView('deposit-history.html'));
app.get('/bonus', sendView('bonus.html'));
app.get('/team', sendView('team.html'));
app.get('/profile', sendView('profile.html'));
app.get('/package', sendView('package.html'));
app.get('/task', sendView('tasks.html'));
app.get('/commission', sendView('commission.html'));
app.get('/leaderboard', sendView('leaderboard.html'));
app.get('/notifications', sendView('notifications.html'));
app.get('/count', sendView('count.html'));
app.get('/reve', sendView('reve.html'));
app.get('/app', sendView('app.html'));
app.get('/r/:referCode', sendView('index.html'));


// নতুন একটি অনন্য বোনাস কোড তৈরি করার জন্য ফাংশন
const generateBonusCode = () => {
    return 'BONUS-' + Math.random().toString(36).substring(2, 8).toUpperCase();
};

// রেজিস্ট্রেশন রুট (OTP যাচাই সহ)
app.post('/register', async (req, res) => {
  const { name, email, password, otp } = req.body;
  if (!name || !email || !password || !otp) return res.status(400).send('Missing name, email, password, or OTP');

  const user = await User.findOne({ email });
  if (!user) return res.status(400).send('User not found. Please send OTP first.');
  if (user.blocked) return res.status(403).send("Your account has been blocked");

  // OTP যাচাই
  if (user.otp !== Number(otp) || user.otpExpiration < Date.now()) {
    return res.status(400).send('Invalid or expired OTP');
  }

  // OTP বৈধ, এখন রেজিস্ট্রেশন সম্পন্ন করা হচ্ছে
  const hashedPassword = await bcrypt.hash(password, 10);
  user.name = name;
  user.password = hashedPassword;
  user.balance = 20;
  user.otp = undefined;
  user.otpExpiration = undefined;
  await user.save();

  try {
      // নতুন বোনাস কোড তৈরি এবং ডেটাবেসে সংরক্ষণ
      const bonusCode = generateBonusCode();
      const newBonus = new BonusCode({
        code: bonusCode,
        reward: 50, // উদাহরণের জন্য, আপনি পুরস্কারের পরিমাণ পরিবর্তন করতে পারেন
        active: true,
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // ৭ দিনের জন্য বৈধ
      });
      await newBonus.save();

      // ব্যবহারকারীকে স্বাগতম ইমেল পাঠানো
      const mailOptions = {
          from: process.env.EMAIL_USER,
          to: email,
          subject: 'Adsonicpro-তে স্বাগতম!',
          html: welcomeEmailTemplate(name, bonusCode)
      };
      await transporter.sendMail(mailOptions);
  } catch (emailError) {
      console.error('Welcome email and bonus code error:', emailError);
      // ইমেল পাঠাতে ব্যর্থ হলেও রেজিস্ট্রেশন সফল হবে, তাই এখানে কোনো ত্রুটি পাঠানো হচ্ছে না।
  }

  res.status(201).send('User registered successfully and a welcome email has been sent.');
});

// লগইন রুট
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).send('Missing credentials');

  const user = await User.findOne({ email });
  if (!user) return res.status(400).send('Invalid email');

  // নিশ্চিত করা হচ্ছে যে ব্যবহারকারীর রেজিস্ট্রেশন সম্পূর্ণ হয়েছে
  if (!user.name) {
    return res.status(400).send('User not fully registered. Please complete registration with OTP.');
  }
  
  if (user.blocked) return res.status(403).send("Your account has been blocked");

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).send('Wrong password');

  const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });

  res.json({ token });
});

app.post('/deposit', authMiddleware, upload, async (req, res) => {
  try {
    const { amount, phone, transactionId, method } = req.body;
    
    let screenshotUrl = null;
    if (req.file) {
        // ফাইলটি মেমরি থেকে সরাসরি Cloudinary-তে আপলোড করা হচ্ছে
        const result = await uploadToCloudinary(req.file.buffer);
        screenshotUrl = result.secure_url;
    }

    const userId = req.user.userId;
    const amountNum = Number(amount);

    // ডিপোজিট রিকোয়েস্টের জন্য একটি অনন্য টোকেন তৈরি করা হচ্ছে
    const approvalToken = crypto.randomBytes(32).toString('hex');

    const deposit = new Deposit({
      userId,
      amount: amountNum,
      phone,
      transactionId,
      method,
      screenshotUrl,
      status: 'pending', // নতুন: স্ট্যাটাস 'pending' হিসেবে শুরু হবে
      approvalToken // নতুন: টোকেন সংরক্ষণ করা হচ্ছে
    });
    await deposit.save();
    
    const user = await User.findById(userId);
    const subject = `নতুন ডিপোজিট রিকোয়েস্ট: ${user.name}`;
    const htmlContent = `
        <h1>নতুন ডিপোজিট রিকোয়েস্ট</h1>
        <p><b>ইউজার:</b> ${user.name}</p>
        <p><b>অ্যামাউন্ট:</b> ${amount} BDT</p>
        <p><b>ফোন নম্বর:</b> ${phone}</p>
        <p><b>ট্রানজেকশন ID:</b> ${transactionId}</p>
        <p><b>মেথড:</b> ${method}</p>
        <p><b>রিকোয়েস্ট ID:</b> ${deposit._id}</p>
        ${screenshotUrl ? `<p><a href="${screenshotUrl}" style="color: #007BFF;">স্ক্রিনশট দেখুন</a></p>` : ''}
        <br/>
        <div style="margin-top: 20px;">
          <a href="${BASE_URL}/api/deposit/approve/${deposit._id}?token=${approvalToken}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-right: 10px;">✅ Approve</a>
          <a href="${BASE_URL}/api/deposit/reject/${deposit._id}?token=${approvalToken}" style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">❌ Reject</a>
        </div>
    `;
    sendAdminNotificationEmail(subject, htmlContent);

    // প্রথম ডিপোজিটের রেফারেল কমিশন লজিক এখানে সরানো হয়েছে, অ্যাপ্রুভালের পর
    // এটি এখন ডিপোজিট অ্যাপ্রুভ হওয়ার পর কার্যকর হবে

    res.send("✅ Deposit request submitted");
  } catch (err) {
    console.error("Deposit error:", err);
    res.status(500).send("❌ Deposit failed");
  }
});

app.get('/api/deposit-history', authMiddleware, async (req, res) => {
  try {
    const history = await Deposit.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching deposit history");
  }
});

// নতুন: ডিপোজিট অ্যাপ্রুভ করার রুট
app.get('/api/deposit/approve/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { token } = req.query;

        const deposit = await Deposit.findById(id);

        if (!deposit || deposit.approvalToken !== token || deposit.status !== 'pending') {
            return res.status(400).send('Invalid or already processed request.');
        }

        const user = await User.findById(deposit.userId);
        if (!user) {
            return res.status(404).send('User not found.');
        }
        
        // ব্যালেন্স যোগ করা হচ্ছে
        user.balance += deposit.amount;

        // প্রথম ডিপোজিটের রেফারেল কমিশন লজিক
        const isFirstDeposit = await Deposit.countDocuments({ userId: deposit.userId, status: 'approved' }) === 0;
        if (isFirstDeposit && deposit.amount >= 300) {
          const referrer = await User.findById(user.referredBy);
          if (referrer) {
            referrer.balance += 20;
            await referrer.save();

            await Commission.create({
              userId: new mongoose.Types.ObjectId(referrer._id),
              amount: 20,
              source: 'Referral',
              note: `Referral reward for ${user.name}'s first approved deposit`
            });
          }
        }

        await user.save();

        // ডিপোজিট স্ট্যাটাস আপডেট করা হচ্ছে
        deposit.status = 'approved';
        deposit.approvalToken = null; // টোকেন বাতিল করা হচ্ছে
        await deposit.save();

        res.send(`<h1>✅ ডিপোজিট সফলভাবে অ্যাপ্রুভ করা হয়েছে!</h1><p>ইউজার: ${user.name}</p><p>অ্যামাউন্ট: ৳${deposit.amount}</p>`);
    } catch (err) {
        console.error('Deposit approve error:', err);
        res.status(500).send('সার্ভার ত্রুটি');
    }
});

// নতুন: ডিপোজিট রিজেক্ট করার রুট
app.get('/api/deposit/reject/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { token } = req.query;

        const deposit = await Deposit.findById(id);

        if (!deposit || deposit.approvalToken !== token || deposit.status !== 'pending') {
            return res.status(400).send('Invalid or already processed request.');
        }

        const user = await User.findById(deposit.userId);
        // ডিপোজিট স্ট্যাটাস আপডেট করা হচ্ছে
        deposit.status = 'rejected';
        deposit.approvalToken = null; // টোকেন বাতিল করা হচ্ছে
        await deposit.save();
        
        res.send(`<h1>❌ ডিপোজিট সফলভাবে রিজেক্ট করা হয়েছে!</h1><p>ইউজার: ${user.name}</p><p>অ্যামাউন্ট: ৳${deposit.amount}</p>`);
    } catch (err) {
        console.error('Deposit reject error:', err);
        res.status(500).send('সার্ভার ত্রুটি');
    }
});

app.post('/withdraw', authMiddleware, async (req, res) => {
  try {
    const { amount, method, number } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).send("User not found");

    if (user.balance < amount) return res.status(400).send("Insufficient balance");

    // উইথড্র রিকোয়েস্টের জন্য একটি অনন্য টোকেন তৈরি করা হচ্ছে
    const approvalToken = crypto.randomBytes(32).toString('hex');

    const withdraw = new Withdraw({
      userId: req.user.userId,
      amount,
      method,
      number,
      status: 'pending', // নতুন: স্ট্যাটাস 'pending' হিসেবে শুরু হবে
      approvalToken // নতুন: টোকেন সংরক্ষণ করা হচ্ছে
    });

    await withdraw.save();
    user.balance -= amount;
    await user.save();
    
    const subject = `নতুন উইথড্র রিকোয়েস্ট: ${user.name}`;
    const htmlContent = `
        <h1>নতুন উইথড্র রিকোয়েস্ট</h1>
        <p><b>ইউজার:</b> ${user.name}</p>
        <p><b>অ্যামাউন্ট:</b> ${amount} BDT</p>
        <p><b>উইথড্র নম্বর:</b> ${number}</p>
        <p><b>মেথড:</b> ${method}</p>
        <p><b>রিকোয়েস্ট ID:</b> ${withdraw._id}</p>
        <br/>
        <div style="margin-top: 20px;">
          <a href="${BASE_URL}/api/withdraw/approve/${withdraw._id}?token=${approvalToken}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-right: 10px;">✅ Approve</a>
          <a href="${BASE_URL}/api/withdraw/reject/${withdraw._id}?token=${approvalToken}" style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">❌ Reject</a>
        </div>
    `;
    sendAdminNotificationEmail(subject, htmlContent);

    res.send("Withdraw request submitted");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

app.get('/api/withdraw-history', authMiddleware, async (req, res) => {
  try {
    const history = await Withdraw.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching withdraw history");
  }
});

// নতুন: উইথড্রল অ্যাপ্রুভ করার রুট
app.get('/api/withdraw/approve/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { token } = req.query;

        const withdraw = await Withdraw.findById(id);

        if (!withdraw || withdraw.approvalToken !== token || withdraw.status !== 'pending') {
            return res.status(400).send('Invalid or already processed request.');
        }

        // উইথড্র স্ট্যাটাস আপডেট করা হচ্ছে
        withdraw.status = 'approved';
        withdraw.approvalToken = null;
        await withdraw.save();

        const user = await User.findById(withdraw.userId);
        res.send(`<h1>✅ উইথড্রল সফলভাবে অ্যাপ্রুভ করা হয়েছে!</h1><p>ইউজার: ${user.name}</p><p>অ্যামাউন্ট: ৳${withdraw.amount}</p><p>অ্যাডমিনকে ম্যানুয়ালি পেমেন্ট সম্পন্ন করতে হবে।</p>`);
    } catch (err) {
        console.error('Withdraw approve error:', err);
        res.status(500).send('সার্ভার ত্রুটি');
    }
});

// নতুন: উইথড্রল রিজেক্ট করার রুট
app.get('/api/withdraw/reject/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { token } = req.query;

        const withdraw = await Withdraw.findById(id);

        if (!withdraw || withdraw.approvalToken !== token || withdraw.status !== 'pending') {
            return res.status(400).send('Invalid or already processed request.');
        }
        
        const user = await User.findById(withdraw.userId);
        if (!user) {
            return res.status(404).send('User not found.');
        }
        
        // ব্যালেন্স ফেরত দেওয়া হচ্ছে
        user.balance += withdraw.amount;
        await user.save();

        // উইথড্র স্ট্যাটাস আপডেট করা হচ্ছে
        withdraw.status = 'rejected';
        withdraw.approvalToken = null;
        await withdraw.save();

        res.send(`<h1>❌ উইথড্রল সফলভাবে রিজেক্ট করা হয়েছে!</h1><p>ইউজার: ${user.name}</p><p>অ্যামাউন্ট: ৳${withdraw.amount}</p><p>ব্যালেন্স ইউজারকে ফেরত দেওয়া হয়েছে।</p>`);
    } catch (err) {
        console.error('Withdraw reject error:', err);
        res.status(500).send('সার্ভার ত্রুটি');
    }
});


app.post('/api/buy-package', authMiddleware, async (req, res) => {
  try {
    const { packageId } = req.body;
    const user = await User.findById(req.user.userId);
    const pkg = await Package.findById(packageId);

    if (!pkg) {
      return res.status(404).json({ message: 'Package not found' });
    }

    if (user.balance < pkg.price) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    user.balance -= pkg.price;
    user.packages.push({
      id: pkg._id,
      name: pkg.name,
      adsPerDay: pkg.adsPerDay,
      boughtAt: new Date()
    });

    await user.save();
    return res.status(200).json({ message: '✅ Package purchased successfully!' });

  } catch (err) {
    console.error('Buy Package Error:', err);
    res.status(500).json({ message: '❌ Server error while buying package' });
  }
});

app.get('/api/packages', async (req, res) => {
  try {
    const packages = await Package.find();
    res.json(packages);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching packages");
  }
});

app.get('/api/user-info', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user) return res.status(404).send('User not found');

  const totalAdsPerDay = user.packages.reduce((sum, p) => sum + p.adsPerDay, 0);
  res.json({
    name: user.name,
    balance: user.balance,
    referCode: user._id.toString(),
    totalAdsPerDay
  });
});

app.post('/api/bonus/redeem', authMiddleware, async (req, res) => {
  const { code } = req.body;

  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).send("User not found");

    if (!user.packages || user.packages.length === 0) {
      return res.status(403).send("❌ You must purchase a package to redeem bonus codes.");
    }

    const bonus = await BonusCode.findOne({ code });

    if (!bonus || !bonus.active) {
      return res.status(400).send("❌ Invalid or expired code");
    }

    if (bonus.usedBy.includes(user._id)) {
      return res.status(400).send("❌ You already used this code");
    }

    const reward = bonus.reward || Math.floor(Math.random() * 11) + 5;

    user.balance += reward;
    await user.save();

    bonus.usedBy.push(user._id);
    await bonus.save();
    await Commission.create({
      userId: new mongoose.Types.ObjectId(user._id),
      amount: reward,
      source: 'Bonus Code',
      note: `Redeemed code: ${code}`
    });

    res.send(`🎉 Bonus received! ৳${reward} added to your balance.`);
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ Server error");
  }
});

app.post('/api/update-profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).send("User not found");

    const { name } = req.body;
    if (name) user.name = name;

    await user.save();
    res.send("Name updated successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to update name");
  }
});

// লিডারবোর্ড API রুট
app.get('/api/leaderboard', authMiddleware, async (req, res) => {
    try {
      const currentUserId = req.user.userId;
      const users = await User.find({});
      const deposits = await Deposit.find({ status: 'approved' });

      const usersWithStats = users.map(user => {
          const totalDeposits = deposits
              .filter(deposit => deposit.userId.toString() === user._id.toString())
              .reduce((sum, deposit) => sum + deposit.amount, 0);

          return {
              _id: user._id,
              name: user.name,
              totalEarnings: user.balance,
              totalDeposits: totalDeposits
          };
      });
      usersWithStats.sort((a, b) => b.totalEarnings - a.totalEarnings);

      // Find the current user's rank and data
      let currentUser = null;
      let currentUserRank = -1;
      
      const currentUserData = usersWithStats.find(user => user._id.toString() === currentUserId);
      
      if (currentUserData) {
          currentUserRank = usersWithStats.findIndex(user => user._id.toString() === currentUserId) + 1;
          currentUser = {
              _id: currentUserData._id,
              name: currentUserData.name,
              totalEarnings: currentUserData.totalEarnings,
              totalDeposits: currentUserData.totalDeposits,
              rank: currentUserRank
          };
      }

      // Get the top 20 users for the leaderboard
      const leaderboard = usersWithStats.slice(0, 20);

      res.json({ leaderboard, currentUser });

    } catch (error) {
      console.error('Leaderboard API error:', error);
      res.status(500).json({ message: 'Server error while fetching leaderboard.' });
    }
});

app.get('/api/my-referrals', authMiddleware, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId);
    if (!currentUser) return res.status(401).send("Invalid user");

    const referredUsers = await User.find({
      referredBy: currentUser._id.toString()
    });

    const approvedUsers = [];

    for (const user of referredUsers) {
      const hasApprovedDeposit = await Deposit.exists({
        userId: user._id,
        status: 'approved'
      });

      if (hasApprovedDeposit) {
        approvedUsers.push({
          name: user.name,
          balance: user.balance
        });
      }
    }

    res.json(approvedUsers);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

app.get("/api/tasks/status", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (!user.packages || user.packages.length === 0) {
      return res.json({ success: true, hasPackage: false });
    }

    const totalAdsPerDay = user.packages.reduce((sum, p) => sum + p.adsPerDay, 0);
    const today = new Date().toISOString().split("T")[0];
    const adsWatched = user.adsWatched?.get(today) || 0;

    res.json({
      success: true,
      hasPackage: true,
      adsWatched,
      adsLimit: totalAdsPerDay
    });
  } catch (err) {
    console.error("Task status error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/tasks/complete", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (!user || !user.packages || user.packages.length === 0) {
      return res.status(400).json({ success: false, message: "No active package found." });
    }
    
    const totalAdsPerDay = user.packages.reduce((sum, p) => sum + p.adsPerDay, 0);
    const today = new Date().toISOString().split("T")[0];
    const watched = user.adsWatched?.get(today) || 0;

    if (watched >= totalAdsPerDay) {
      return res.status(400).json({ success: false, message: "Daily ad limit reached." });
    }

    const newWatched = watched + 1;
    user.adsWatched.set(today, newWatched);
    user.markModified('adsWatched');
    user.balance += 20;
    
    await Commission.create({
      userId: new mongoose.Types.ObjectId(userId),
      amount: 20,
      source: 'Ad Watch',
      note: `Ad watch #${newWatched}`
    });

    await user.save();

    res.json({ success: true, message: "Ad watched successfully!", newBalance: user.balance });
  } catch (err) {
    console.error("Watch ad error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/support/tickets", authMiddleware, async (req, res) => {
  try {
    const { subject, message } = req.body;
    const userId = req.user.userId;

    if (!subject || !message) {
      return res.status(400).json({ success: false, message: "বিষয় এবং বার্তা উভয়ই প্রয়োজন।" });
    }

    const newTicket = new SupportTicket({
      userId,
      subject,
      message,
      status: 'open'
    });

    await newTicket.save();

    res.json({ success: true, message: "আপনার টিকিট সফলভাবে জমা দেওয়া হয়েছে। আমরা শীঘ্রই আপনার সাথে যোগাযোগ করব।" });

  } catch (err) {
    console.error("Support ticket submission error:", err);
    res.status(500).json({ success: false, message: "সার্ভার ত্রুটি। আবার চেষ্টা করুন।" });
  }
});

app.get('/api/notifications', authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find({}).sort({ createdAt: -1 });
    res.json({ success: true, notifications: notifications });
  } catch (err) {
    console.error("Notification fetch error:", err);
    res.status(500).json({ success: false, message: "সার্ভার ত্রুটি।" });
  }
});

// OTP পাঠানোর রুট
app.post('/send-otp', async (req, res) => {
    const { email, referCode } = req.body;
    if (!email) return res.status(400).send('Email is required');

    const existingUser = await User.findOne({ email });

    if (existingUser && existingUser.name) {
        return res.status(400).send('Email already in use.');
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    const otpExpiration = Date.now() + 5 * 60 * 1000;

    let user;
    if (existingUser) {
        user = existingUser;
    } else {
        user = new User({ email });
    }

    if (referCode) {
        const referrer = await User.findById(referCode);
        if (referrer) {
            user.referredBy = referrer._id;
        }
    }
    
    user.otp = otp;
    user.otpExpiration = otpExpiration;
    await user.save();

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Your OTP for Registration',
        html: emailTemplate(otp)
    };

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).send('OTP sent to your email.');
    } catch (error) {
        console.error('Email send error:', error);
        res.status(500).send('Failed to send OTP.');
    }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
