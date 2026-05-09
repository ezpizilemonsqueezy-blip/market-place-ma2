module.exports = (temp, product) => {
  return temp
    .replace(/{%PRODUCTNAME%}/g, product.name || '')
    .replace(/{%PRICE%}/g, product.price || 0)
    .replace(/{%CATEGORY%}/g, product.category || '')
    .replace(/{%DESCRIPTION%}/g, product.description || '')
    .replace(/{%SELLER%}/g, product.seller || '')
    .replace(/{%ID%}/g, product.id || '');
};