let currentEditId = null;

document.addEventListener('DOMContentLoaded', function() {
  const addProductButton = document.getElementById('addProductBtn');
  const closeProductModalButton = document.getElementById('closeProductModal');
  const cancelProductModalButton = document.getElementById('cancelProductModal');
  const updateButtons = document.querySelectorAll('.btn-update');
  const productForm = document.getElementById('productForm');

  if (addProductButton) {
    addProductButton.addEventListener('click', showAddProductModal);
  }

  if (closeProductModalButton) {
    closeProductModalButton.addEventListener('click', closeModal);
  }

  if (cancelProductModalButton) {
    cancelProductModalButton.addEventListener('click', closeModal);
  }
  
  updateButtons.forEach(button => {
    const productId = button.getAttribute('data-product-id');
    
    button.addEventListener('click', function() {
      showUpdateProductModal(parseInt(productId));
    });
  });
  
  const deleteButtons = document.querySelectorAll('.btn-delete');
  
  deleteButtons.forEach(button => {
    const productId = button.getAttribute('data-product-id');
    
    button.addEventListener('click', function() {
      deleteProduct(parseInt(productId));
    });
  });

  if (productForm) {
    productForm.addEventListener('submit', handleProductFormSubmit);
  }
});

function showAddProductModal() {
  currentEditId = null;
  document.getElementById('modalTitle').textContent = 'Add New Product';
  document.getElementById('productForm').reset();
  document.getElementById('productModal').style.display = 'block';
}

function showUpdateProductModal(productId) {
  alert('Not Implemented Yet');
}

function closeModal() {
  document.getElementById('productModal').style.display = 'none';
  document.getElementById('productForm').reset();
  currentEditId = null;
}

function addProduct(productData) {
  return fetch('/api/v1/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(productData)
  });
}

function updateProduct(productId, productData) {
  return fetch(`/api/v1/products/${productId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(productData)
  });
}

function deleteProduct(productId) {
  alert('Not Implemented Yet');
}

function handleProductFormSubmit(e) {
  e.preventDefault();
  
  const productData = {
    name: document.getElementById('name').value,
    price: parseFloat(document.getElementById('price').value),
    category: document.getElementById('category').value,
    description: document.getElementById('description').value,
    seller: document.getElementById('seller').value
  };
  
  const request = currentEditId ? 
    updateProduct(currentEditId, productData) : 
    addProduct(productData);
  
  request
    .then(response => response.json())
    .then(data => {
      if (data.status === 'success') {
        alert(`Product ${currentEditId ? 'updated' : 'added'} successfully!`);
        closeModal();
        location.reload();
      } else {
        alert(`Error: ${data.message}`);
      }
    })
    .catch(error => {
      alert('Error saving product');
    });
}

window.onclick = function(event) {
  const modal = document.getElementById('productModal');
  if (event.target === modal) {
    closeModal();
  }
}

window.showUpdateProductModal = showUpdateProductModal;
window.deleteProduct = deleteProduct;
window.showAddProductModal = showAddProductModal;
window.closeModal = closeModal;
