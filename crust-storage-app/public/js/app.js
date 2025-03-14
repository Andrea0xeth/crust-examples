document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded');
  
  // Get configuration from the server
  const config = window.APP_CONFIG || {};
  console.log('App config:', config);
  
  // Check if PeraWalletConnect is available globally
  if (typeof PeraWalletConnect === 'undefined') {
    console.error('ERRORE: PeraWalletConnect non è disponibile');
    
    // Add alert to the page
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger mt-3';
    alertDiv.innerHTML = `
      <strong>Errore di caricamento!</strong>
      <p>La libreria Pera Wallet non è stata caricata correttamente. Prova a ricaricare la pagina o a usare un browser diverso.</p>
    `;
    
    const walletSection = document.getElementById('wallet-connect-section');
    if (walletSection) {
      walletSection.prepend(alertDiv);
    }
    
    // Try to load the library again
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/@perawallet/connect@2.1.0/dist/index.umd.min.js";
    script.onload = function() {
      console.log('Libreria caricata con successo tramite script dinamico');
      location.reload(); // Reload the page to use the newly loaded library
    };
    document.head.appendChild(script);
    
    return; // Stop execution until library is loaded
  }
  
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

  // Initialize Pera Wallet Connect with proper options following the documentation
  const peraWalletOptions = {
    shouldShowSignTxnToast: true,
    network: 'mainnet'
  };
  
  // Add project ID if available (required for WalletConnect v2)
  if (config.walletConnectProjectId) {
    peraWalletOptions.projectId = config.walletConnectProjectId;
    console.log('Using WalletConnect Project ID:', config.walletConnectProjectId);
  } else {
    console.warn('No WalletConnect Project ID found in configuration!');
  }

  console.log('Initializing Pera Wallet with options:', peraWalletOptions);
  
  try {
    // Create the wallet instance
    const peraWallet = new PeraWalletConnect(peraWalletOptions);
    console.log('Pera Wallet instance created successfully');
    initializeApp(peraWallet);
  } catch (error) {
    console.error('Error creating Pera Wallet instance:', error);
    
    // Add error alert
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger mt-3';
    alertDiv.innerHTML = `
      <strong>Errore di inizializzazione!</strong>
      <p>Non è stato possibile inizializzare Pera Wallet: ${error.message}</p>
    `;
    
    const walletSection = document.getElementById('wallet-connect-section');
    if (walletSection) {
      walletSection.prepend(alertDiv);
    }
  }
  
  // Main app initialization function
  function initializeApp(peraWallet) {
    // Function to handle wallet disconnection
    function handleDisconnect() {
      console.log('Wallet disconnected');
      walletConnected = false;
      account = null;
      walletStatus.classList.add('d-none');
      uploadBtn.disabled = true;
      placeOrderBtn.disabled = true;
      
      connectWalletBtn.disabled = false;
      connectWalletBtn.textContent = 'Connect with Pera Wallet';
      connectWalletBtn.classList.remove('btn-success');
      connectWalletBtn.classList.add('btn-primary');
    }
    
    // Try to reconnect to existing session on page load
    console.log('Trying to reconnect to existing session...');
    peraWallet.reconnectSession().then((accounts) => {
      console.log('Reconnect session result:', accounts);
      
      // Setup the disconnect event listener
      peraWallet.connector?.on("disconnect", handleDisconnect);
      
      if (accounts.length) {
        account = accounts[0];
        walletConnected = true;
        walletAddress.textContent = account;
        walletStatus.classList.remove('d-none');
        uploadBtn.disabled = false;
        
        connectWalletBtn.textContent = 'Connected';
        connectWalletBtn.classList.remove('btn-primary');
        connectWalletBtn.classList.add('btn-success');
        
        console.log('Successfully reconnected to session with account:', account);
      } else {
        console.log('No existing session found');
      }
    }).catch(error => {
      console.error('Error reconnecting session:', error);
    });

    // Handle wallet connection
    connectWalletBtn.addEventListener('click', async () => {
      console.log('Connect wallet button clicked');
      
      if (walletConnected) {
        console.log('Already connected, disconnecting...');
        
        try {
          await peraWallet.disconnect();
          handleDisconnect();
        } catch (error) {
          console.error('Error disconnecting wallet:', error);
        }
        
        return;
      }
      
      try {
        connectWalletBtn.disabled = true;
        connectWalletBtn.textContent = 'Connecting...';

        console.log('Attempting to connect to Pera Wallet...');
        const accounts = await peraWallet.connect();
        console.log('Connected accounts:', accounts);
        
        // Setup the disconnect event listener
        peraWallet.connector?.on("disconnect", handleDisconnect);
        
        if (accounts.length) {
          account = accounts[0];
          walletConnected = true;
          walletAddress.textContent = account;
          walletStatus.classList.remove('d-none');
          uploadBtn.disabled = false;

          connectWalletBtn.textContent = 'Connected';
          connectWalletBtn.classList.remove('btn-primary');
          connectWalletBtn.classList.add('btn-success');
          
          console.log('Successfully connected with account:', account);
        }
      } catch (error) {
        console.error('Connection error:', error);
        
        // Handle the CONNECT_MODAL_CLOSED error
        if (error?.data?.type !== "CONNECT_MODAL_CLOSED") {
          alert('Failed to connect wallet: ' + error.message);
        } else {
          console.log('Connect modal was closed by user');
        }
        
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
  }

  // For demo purposes only - using localStorage to store a test mnemonic
  // In a real app, you would use secure methods to handle the mnemonic
  if (!localStorage.getItem('testMnemonic')) {
    // This is just a placeholder, NOT a real mnemonic
    localStorage.setItem('testMnemonic', 'test test test test test test test test test test test test');
  }
}); 