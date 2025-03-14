const express = require('express');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const path = require('path');
const algosdk = require('algosdk');
const axios = require('axios');
const FormData = require('form-data');
const nacl = require('tweetnacl');
const fs = require('fs');
require('dotenv').config();

// Initialize the express app
const app = express();
const port = 3001; // Using 3001 to avoid conflict with existing app

// Get environment variables
const STORAGE_APP_ID = process.env.STORAGE_APP_ID || 1275319623; // Fallback to hardcoded value if env not set
const WALLET_CONNECT_PROJECT_ID = process.env.WALLET_CONNECT_PROJECT_ID;
const IPFS_API_ENDPOINT = process.env.IPFS_API_ENDPOINT || 'https://gw-seattle.crustcloud.io:443/api/v0/add';
const ALGOD_SERVER = process.env.ALGOD_SERVER || 'https://mainnet-api.algonode.cloud';
const ALGOD_TOKEN = process.env.ALGOD_TOKEN || '';
const ALGOD_PORT = process.env.ALGOD_PORT || '';

// Log environment variables (without sensitive data)
console.log(`Using Storage App ID: ${STORAGE_APP_ID}`);
console.log(`WalletConnect Project ID available: ${!!WALLET_CONNECT_PROJECT_ID}`);
console.log(`IPFS API Endpoint: ${IPFS_API_ENDPOINT}`);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
  createParentPath: true,
  limits: { fileSize: 1 * 1024 * 1024 }, // 1MB limit
}));

// Set the view engine to ejs
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Create Algorand client using environment variables
const algodClient = new algosdk.Algodv2(
  ALGOD_TOKEN,
  ALGOD_SERVER,
  ALGOD_PORT
);

// Routes
app.get('/', (req, res) => {
  // Pass the WalletConnect project ID to the frontend
  res.render('index', { 
    walletConnectProjectId: WALLET_CONNECT_PROJECT_ID,
    storageAppId: STORAGE_APP_ID
  });
});

// API endpoint to get the Algorand network status
app.get('/api/network-status', async (req, res) => {
  try {
    const status = await algodClient.status().do();
    res.json({ success: true, status });
  } catch (error) {
    console.error('Error getting network status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API endpoint to get configuration
app.get('/api/config', (req, res) => {
  res.json({
    walletConnectProjectId: WALLET_CONNECT_PROJECT_ID,
    storageAppId: STORAGE_APP_ID
  });
});

// Helper function to generate web3 auth header from an Algorand account
function getAuthHeader(account) {
  const sk32 = account.sk.slice(0, 32);
  const signingKey = nacl.sign.keyPair.fromSeed(sk32);

  const signature = nacl.sign(Buffer.from(account.addr), signingKey.secretKey);
  const sigHex = Buffer.from(signature).toString('hex').slice(0, 128);
  const authStr = `sub-${account.addr}:0x${sigHex}`;

  return Buffer.from(authStr).toString('base64');
}

// API endpoint to upload file to IPFS
app.post('/api/upload', async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ success: false, message: 'No files were uploaded.' });
    }

    // Get the file from the request
    const file = req.files.file;
    const tempFilePath = path.join(__dirname, 'temp_uploads', file.name);
    
    // Create uploads directory if it doesn't exist
    fs.mkdirSync(path.join(__dirname, 'temp_uploads'), { recursive: true });
    
    // Save the file to a temporary location
    await file.mv(tempFilePath);

    // Get the mnemonic from the request (in production, this should be handled more securely)
    const mnemonic = req.body.mnemonic;
    if (!mnemonic) {
      return res.status(400).json({ success: false, message: 'Mnemonic is required.' });
    }

    // Convert mnemonic to account
    const account = algosdk.mnemonicToSecretKey(mnemonic);

    // Upload to IPFS
    const formData = new FormData();
    formData.append('file', fs.createReadStream(tempFilePath));

    // Use the IPFS endpoint from environment variables
    const apiEndpoint = IPFS_API_ENDPOINT;

    const headers = {
      "Authorization": `Basic ${getAuthHeader(account)}`
    };

    const response = await axios.post(apiEndpoint, formData, {
      headers: {
        ...headers,
        ...formData.getHeaders()
      }
    });

    // Clean up the temporary file
    fs.unlinkSync(tempFilePath);

    // Get CID and size from response
    const { Hash: cid, Size: size } = response.data;

    // Get storage price
    const appClient = await getStorageAppClient(algodClient, account);
    const price = await getPrice(algodClient, appClient, Number(size), false); // false for temporary storage

    res.json({ 
      success: true, 
      cid, 
      size: Number(size),
      price,
      priceInAlgos: price / 1000000 // Convert microAlgos to Algos
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API endpoint to place a storage order
app.post('/api/place-order', async (req, res) => {
  try {
    const { mnemonic, cid, size, price, isPermanent } = req.body;

    if (!mnemonic || !cid || !size || !price) {
      return res.status(400).json({ success: false, message: 'Missing required parameters.' });
    }

    // Convert mnemonic to account
    const account = algosdk.mnemonicToSecretKey(mnemonic);

    // Set up app client
    const appClient = await getStorageAppClient(algodClient, account);

    // Place the order
    await placeOrder(
      algodClient,
      appClient,
      account,
      cid,
      Number(size),
      Number(price),
      isPermanent === 'true'
    );

    res.json({ success: true, message: 'Storage order placed successfully.' });
  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper function to get a storage app client
async function getStorageAppClient(algodClient, account) {
  // This is a placeholder. In a real app, you would use the Crust SDK or implement the ABI interface.
  // For now, we'll return a simplified version
  return {
    compose: () => ({
      getPrice: ({ size, is_permanent }) => ({
        atc: () => ({
          simulate: async () => ({
            methodResults: [{ returnValue: { valueOf: () => calculatePrice(size, is_permanent) } }]
          })
        })
      }),
      getRandomOrderNode: () => ({
        atc: () => ({
          simulate: async () => ({
            methodResults: [{ returnValue: { valueOf: () => "ZNGTCUMUAK5CTIOCEH4GBWVLLVXU3ELXOVLJSJXCQO5HWVQ5NVWPBOKPQA" } }]
          })
        })
      })
    }),
    placeOrder: async ({ seed, cid, size, is_permanent, merchant }) => {
      // Simulate placing an order
      console.log(`Placing order for CID ${cid} of size ${size} with merchant ${merchant}`);
      // In a real app, this would make the actual contract call
      return true;
    },
    appClient: {
      getAppReference: async () => ({
        appAddress: "THEICRUSTAPPADDRESSWOULDGOHERE777777777777777777777777777"
      })
    }
  };
}

// Helper function to calculate price (this is a simplified version of what the contract would return)
function calculatePrice(size, isPermanent) {
  const basePrice = 250000; // 0.25 Algos base price
  const bytePrice = 100;    // 100 microAlgos per KB
  const permanentMultiplier = 5; // 5x multiplier for permanent storage
  
  const sizeInKB = Math.ceil(size / 1024);
  const byteCost = sizeInKB * bytePrice;
  let totalPrice = basePrice + byteCost;
  
  if (isPermanent) {
    totalPrice *= permanentMultiplier;
  }
  
  return totalPrice;
}

// Helper function to get storage price
async function getPrice(algod, appClient, size, isPermanent = false) {
  const result = await (await appClient.compose().getPrice({ size, is_permanent: isPermanent }).atc()).simulate(algod);
  return result.methodResults[0].returnValue?.valueOf();
}

// Helper function to get a random order node
async function getOrderNode(algod, appClient) {
  return (await (await appClient.compose().getRandomOrderNode({}).atc()).simulate(algod)).methodResults[0].returnValue?.valueOf();
}

// Helper function to place a storage order
async function placeOrder(
  algod,
  appClient,
  account,
  cid,
  size,
  price,
  isPermanent
) {
  try {
    const merchant = await getOrderNode(algod, appClient);
    const suggestedParams = await algod.getTransactionParams().do();
    
    const seed = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      from: account.addr,
      to: (await appClient.appClient.getAppReference()).appAddress,
      amount: price,
      suggestedParams,
    });
    
    console.log(`Placing order with: CID=${cid}, Size=${size}, Price=${price}, IsPermanent=${isPermanent}, Merchant=${merchant}`);
    
    // In a real app, this would execute the transaction
    return await appClient.placeOrder({ seed, cid, size, is_permanent: isPermanent, merchant });
  } catch (error) {
    console.error('Error in placeOrder:', error);
    throw error;
  }
}

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
}); 