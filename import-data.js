const mongoose = require('mongoose');
const fs = require('fs');
const Product = require('./models/productModel');
require('dotenv').config({ path: './config.env' });

const importData = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.DATABASE);

    // Read JSON file
    const products = JSON.parse(fs.readFileSync(`${__dirname}/data/products.json`, 'utf-8'));

    // Remove id field from each product
    const productsWithoutId = products.map(product => {
      const { id, ...productWithoutId } = product;
      return productWithoutId;
    });

    // Import data
    await Product.create(productsWithoutId);

    console.log('Data successfully imported!');
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

const deleteData = async () => {
  try {
    await mongoose.connect(process.env.DATABASE);
    await Product.deleteMany();
    console.log('Data successfully deleted!');
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

if (process.argv[2] === '--import') {
  importData();
} else if (process.argv[2] === '--delete') {
  deleteData();
}