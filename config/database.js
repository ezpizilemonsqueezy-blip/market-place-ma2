const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }

    const conn = await mongoose.connect(process.env.DATABASE, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 15000,
      maxPoolSize: 10,
      minPoolSize: 5,
      retryWrites: true,
      w: 'majority',
      family: 4 // Use IPv4, skip trying IPv6
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn.connection;
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    console.error('\n📋 Troubleshooting - Try these steps:');
    console.error('1. ✓ Verify internet connection is active');
    console.error('2. ✓ Check MongoDB Atlas IP whitelist:');
    console.error('   - Go to: https://account.mongodb.com/account/login');
    console.error('   - Click: Network Access > Add IP Address');
    console.error('   - Allow: 0.0.0.0/0 (for development) or your specific IP');
    console.error('3. ✓ Verify cluster is ACTIVE (not paused)');
    console.error('4. ✓ Check DATABASE connection string in config.env');
    console.error('5. ✓ Verify username and password are correct');

    console.log('App will continue without database connection...');
    return null;
  }
};

module.exports = connectDB;
