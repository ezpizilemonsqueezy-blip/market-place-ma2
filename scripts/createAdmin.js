const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', 'config.env') });

// Import User model
const User = require('../models/userModel');

const createAdmin = async () => {
  try {
    // Connect to database
    const DB = process.env.DATABASE.replace(
      '<PASSWORD>',
      process.env.DATABASE_PASSWORD
    );

    await mongoose.connect(DB);

    console.log('Connected to database...');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.email);
      process.exit(0);
    }

    // Create admin user with unique email
    const timestamp = Date.now();
    const adminUser = await User.create({
      name: 'Admin User',
      email: `admin${timestamp}@example.com`,
      password: 'Password123',
      passwordConfirm: 'Password123',
      role: 'admin'
    });

    console.log('Admin user created successfully!');
    console.log('Email:', adminUser.email);
    console.log('Password: Password123');
    console.log('Role: admin');

  } catch (error) {
    console.error('Error creating admin:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed.');
    process.exit(0);
  }
};

// Run the script
createAdmin();