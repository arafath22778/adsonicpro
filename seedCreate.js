// scripts/seedPackages.js

const mongoose = require('mongoose');
const Package = require('./models/Package');

mongoose.connect("mongodb+srv://arafarh:arafath@cluster0.qmoudrd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0", {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const packages = [
  { name: "Basic", price: 300, adsPerDay: 1 },
  { name: "Standard", price: 550, adsPerDay: 2 },
  { name: "Pro", price: 1700, adsPerDay: 5 },
  { name: "Elite", price: 2000, adsPerDay: 7 },
  { name: "Business", price: 5000, adsPerDay: 17 },
  { name: "Premium", price: 10000, adsPerDay: 35 },
  { name: "Ultimate", price: 20000, adsPerDay: 70 },
  { name: "Enterprise", price: 50000, adsPerDay: 170},
  { name: "Mega", price: 75000, adsPerDay: 280 },
  { name: "VIP", price: 100000, adsPerDay: 500 }
];

async function seed() {
  await Package.deleteMany({});
  await Package.insertMany(packages);
  console.log("Packages seeded ✅");
  process.exit();
}

seed();