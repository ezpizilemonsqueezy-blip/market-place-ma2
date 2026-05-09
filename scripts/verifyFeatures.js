const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('../models/productModel');

dotenv.config({ path: path.join(__dirname, '..', 'config.env') });

const importSeedData = async () => {
  const filePath = path.join(__dirname, '..', 'data', 'products.json');
  const products = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const productsWithoutId = products.map(({ id, ...product }) => product);

  await Product.deleteMany();
  await Product.create(productsWithoutId);
};

const run = async () => {
  await mongoose.connect(process.env.DATABASE);
  await importSeedData();

  const productCategories = await Product.aggregate([
    { $match: { price: { $lt: 1000 } } },
    {
      $group: {
        _id: { $toUpper: '$category' },
        totalProducts: { $sum: 1 },
        products: {
          $push: {
            name: '$name',
            price: '$price',
            productSlug: '$productSlug',
            postedDate: '$postedDate'
          }
        },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' }
      }
    },
    {
      $addFields: {
        averagePrice: { $round: ['$avgPrice', 2] },
        minimumPrice: '$minPrice',
        maximumPrice: '$maxPrice'
      }
    },
    {
      $project: {
        _id: 0,
        category: '$_id',
        totalProducts: 1,
        products: 1,
        averagePrice: 1,
        minimumPrice: 1,
        maximumPrice: 1
      }
    },
    { $sort: { averagePrice: 1 } }
  ]);

  const sampleProduct = await Product.findOne({ name: 'Budget USB Office Mouse' }).select('+createdAt');
  const allVisibleProducts = await Product.find();
  const hiddenPremiumCount = await Product.collection.countDocuments({
    premiumProducts: true
  });
  const premiumFindAttempt = await Product.find({ premiumProducts: true }).select(
    'name premiumProducts'
  );
  const premiumAggAttempt = await Product.aggregate([
    { $match: { premiumProducts: true } },
    { $project: { name: 1, premiumProducts: 1 } }
  ]);

  const badDescription = new Product({
    name: 'Validator Description Demo',
    price: 900,
    category: 'Validator',
    description: 'This description is intentionally longer than fifty characters total.',
    seller: 'Test Seller'
  });

  const badDiscount = new Product({
    name: 'Validator Discount Demo',
    price: 900,
    category: 'Validator',
    description: 'Invalid discount sample',
    seller: 'Test Seller',
    priceDiscount: 950
  });

  const output = {
    aggregationRoutePreview: productCategories,
    virtualPropertySample: {
      name: sampleProduct.name,
      postedDate: sampleProduct.postedDate,
      daysPosted: sampleProduct.daysPosted
    },
    documentMiddlewareSample: {
      name: sampleProduct.name,
      productSlug: sampleProduct.productSlug
    },
    queryMiddlewareSample: {
      visibleProductCount: allVisibleProducts.length,
      hiddenPremiumCount,
      premiumFindAttemptCount: premiumFindAttempt.length,
      premiumFlagsReturned: [...new Set(premiumFindAttempt.map(product => product.premiumProducts))]
    },
    aggregateMiddlewareSample: {
      premiumAggregateAttemptCount: premiumAggAttempt.length
    },
    builtInValidatorMessage:
      badDescription.validateSync()?.errors?.description?.message || null,
    customValidatorMessage:
      badDiscount.validateSync()?.errors?.priceDiscount?.message || null
  };

  const outPath = path.join(__dirname, '..', 'verification-output.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));

  await mongoose.connection.close();
};

run().catch(async err => {
  console.error(err);
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  process.exit(1);
});
