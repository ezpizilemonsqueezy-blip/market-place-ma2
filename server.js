const path = require('path');
const dotenv = require('dotenv');
const connectDB = require('./config/database');
const app = require('./app');

dotenv.config({ path: path.join(__dirname, 'config.env') });

const port = process.env.PORT || 3000;

const startServer = async () => {
  const dbConnection = await connectDB();

  app.listen(port, () => {
    if (dbConnection) {
      console.log(`App running on port ${port} in ${process.env.NODE_ENV} mode...`);
    } else {
      console.warn(`App running on port ${port}, but MongoDB did not connect. Check your DATABASE settings and network access.`);
    }
  });
};

startServer();