const express = require('express');
const productController = require('../controllers/productController');
const authController = require('../controllers/authController');

const router = express.Router();

router.param('id', productController.checkID);

// Step 1: New route for category stats
router.route('/product-category').get(productController.getProductStats);

router
  .route('/top-3-cheap')
  .get(productController.aliasTopCheap, productController.getAllProducts);

router
  .route('/')
  .get(productController.getAllProducts)
  .post(productController.checkBody, productController.createProduct);

router
  .route('/:id')
  .get(productController.getProduct)
  .patch(productController.updateProduct)
  .delete(authController.protect, authController.restrictTo('admin'), productController.deleteProduct);

module.exports = router;
