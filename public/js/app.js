document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const connectWalletBtn = document.getElementById('connect-wallet-btn');
  const walletStatus = document.getElementById('wallet-status');
  const walletAddress = document.getElementById('wallet-address');
  const uploadForm = document.getElementById('upload-form');
  const uploadBtn = document.getElementById('upload-btn');
  const fileInput = document.getElementById('file-input');
  const isPermanentCheckbox = document.getElementById('is-permanent');
  const uploadProgress = document.getElementById('upload-progress');
  const uploadProgressBar = uploadProgress.querySelector('.progress-bar');
  const uploadResult = document.getElementById('upload-result');
  const fileCid = document.getElementById('file-cid');
  const fileSize = document.getElementById('file-size');
  const storagePrice = document.getElementById('storage-price');
  const storagePriceAlgos = document.getElementById('storage-price-algos');
  const placeOrderBtn = document.getElementById('place-order-btn');
  const orderResult = document.getElementById('order-result');

  // State
  let walletConnected = false;
  let account = null;
  let uploadedFileData = null;

  // Initialize Pera Connect
  const peraWallet = new window.PeraWalletConnect();

  // Handle wallet connection
  connectWalletBtn.addEventListener('click', async () => {
    try {
      connectWalletBtn.disabled = true;
      connectWalletBtn.textContent = 'Connecting...';

      const accounts = await peraWallet.connect();
      account = accounts[0];
      
      walletConnected = true;
      walletAddress.textContent = account;
      walletStatus.classList.remove('d-none');
      uploadBtn.disabled = false;

      connectWalletBtn.textContent = 'Connected';
      connectWalletBtn.classList.remove('btn-primary');
      connectWalletBtn.classList.add('btn-success');
    } catch (error) {
      console.error('Connection error:', error);
      alert('Failed to connect wallet: ' + error.message);
      connectWalletBtn.disabled = false;
      connectWalletBtn.textContent = 'Connect with Pera Wallet';
    }
  });

  // Handle file upload
  uploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!walletConnected) {
      alert('Please connect your wallet first');
      return;
    }

    const file = fileInput.files[0];
    if (!file) {
      alert('Please select a file');
      return;
    }

    if (file.size > 1024 * 1024) {
      alert('File size must be less than 1 MB');
      return;
    }

    try {
      // Show progress
      uploadBtn.disabled = true;
      uploadProgress.classList.remove('d-none');
      uploadProgressBar.style.width = '50%';
      uploadResult.classList.add('d-none');
      placeOrderBtn.disabled = true;

      // Create FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mnemonic', localStorage.getItem('testMnemonic') || ''); // NOTE: This is just for demo purposes
      formData.append('isPermanent', isPermanentCheckbox.checked);

      // Upload to server
      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          uploadProgressBar.style.width = `${progress}%`;
        }
      });

      // Update UI with results
      uploadProgressBar.style.width = '100%';
      
      if (response.data.success) {
        uploadedFileData = {
          cid: response.data.cid,
          size: response.data.size,
          price: response.data.price,
          isPermanent: isPermanentCheckbox.checked
        };

        fileCid.textContent = response.data.cid;
        fileSize.textContent = response.data.size;
        storagePrice.textContent = response.data.price;
        storagePriceAlgos.textContent = response.data.priceInAlgos.toFixed(6);
        
        uploadResult.classList.remove('d-none');
        placeOrderBtn.disabled = false;
      } else {
        alert('Upload failed: ' + response.data.message);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload file: ' + (error.response?.data?.error || error.message));
    } finally {
      uploadBtn.disabled = false;
    }
  });

  // Handle place order
  placeOrderBtn.addEventListener('click', async () => {
    if (!walletConnected) {
      alert('Please connect your wallet first');
      return;
    }

    if (!uploadedFileData) {
      alert('Please upload a file first');
      return;
    }

    try {
      placeOrderBtn.disabled = true;
      placeOrderBtn.textContent = 'Processing...';
      orderResult.classList.add('d-none');

      // Prepare order data
      const orderData = {
        mnemonic: localStorage.getItem('testMnemonic') || '', // NOTE: This is just for demo purposes
        cid: uploadedFileData.cid,
        size: uploadedFileData.size,
        price: uploadedFileData.price,
        isPermanent: uploadedFileData.isPermanent
      };

      // Place order
      const response = await axios.post('/api/place-order', orderData);

      if (response.data.success) {
        orderResult.classList.remove('d-none');
      } else {
        alert('Order failed: ' + response.data.message);
      }
    } catch (error) {
      console.error('Order error:', error);
      alert('Failed to place order: ' + (error.response?.data?.error || error.message));
    } finally {
      placeOrderBtn.disabled = false;
      placeOrderBtn.textContent = 'Place Storage Order';
    }
  });

  // For demo purposes only - using localStorage to store a test mnemonic
  // In a real app, you would use secure methods to handle the mnemonic
  if (!localStorage.getItem('testMnemonic')) {
    // This is just a placeholder, NOT a real mnemonic
    localStorage.setItem('testMnemonic', 'test test test test test test test test test test test test');
  }
}); 