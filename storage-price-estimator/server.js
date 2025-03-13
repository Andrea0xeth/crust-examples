const express = require('express');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const path = require('path');
const algosdk = require('algosdk');
const algokit = require('@algorandfoundation/algokit-utils');
const fs = require('fs');
const axios = require('axios');

// Initialize the express app
const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
  createParentPath: true,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
}));

// Set the view engine to ejs
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Create Algorand client - using AlgoNode for testnet
const algodClient = new algosdk.Algodv2(
  '', // Empty API key 
  'https://testnet-api.algonode.cloud', 
  ''
);

// Default pricing parameters
const DEFAULT_BASE_PRICE = 250000; // 0.25 Algos base price
const DEFAULT_BYTE_PRICE = 100;    // 100 microAlgos per KB
const DEFAULT_PERMANENT_MULTIPLIER = 5; // 5x multiplier for permanent storage

// Cache per i prezzi dei token
let tokenPriceCache = {
  algo: null,
  crust: null,
  timestamp: null
};

// Gestione dei rate limit
let nextAllowedFetchTime = 0; // Timestamp che indica quando possiamo fare la prossima richiesta
const DEFAULT_CACHE_DURATION = 60 * 1000; // 1 minuto di cache di default
let currentBackoffTime = 60 * 1000; // Inizia con 1 minuto di backoff

/**
 * Ottiene i prezzi attuali dei token da CoinGecko
 * @param {boolean} forceRefresh Se true, ignora la cache e recupera sempre i prezzi freschi
 * @returns {Promise<{algoPrice: number, crustPrice: number}>}
 */
async function getTokenPrices(forceRefresh = false) {
  try {
    const now = Date.now();
    
    // Se abbiamo prezzi in cache validi e non è richiesto un refresh forzato, usiamo quelli
    if (!forceRefresh && tokenPriceCache.timestamp && (now - tokenPriceCache.timestamp < DEFAULT_CACHE_DURATION)) {
      console.log('Using cached token prices');
      return {
        algoPrice: tokenPriceCache.algo,
        crustPrice: tokenPriceCache.crust
      };
    }
    
    // Controlliamo se possiamo fare una richiesta o se dobbiamo aspettare
    if (now < nextAllowedFetchTime) {
      const waitTime = Math.ceil((nextAllowedFetchTime - now) / 1000);
      console.log(`Rate limit in effect. Need to wait ${waitTime} seconds before next request.`);
      
      // Se abbiamo prezzi in cache, li usiamo anche se potrebbero essere vecchi
      if (tokenPriceCache.algo && tokenPriceCache.crust) {
        console.log('Using older cached token prices while rate limited');
        return {
          algoPrice: tokenPriceCache.algo,
          crustPrice: tokenPriceCache.crust
        };
      }
      
      // Altrimenti, utilizziamo valori predefiniti
      return { algoPrice: 0.15, crustPrice: 0.70 };
    }

    // Altrimenti, ottieni i prezzi aggiornati
    console.log('Fetching fresh token prices from CoinGecko');
    try {
      const response = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price',
        {
          params: {
            ids: 'algorand,crust-network',
            vs_currencies: 'usd'
          }
        }
      );

      // Reset del backoff se la richiesta ha successo
      currentBackoffTime = 60 * 1000; // Reset a 1 minuto

      // Estrai i prezzi dalla risposta
      const algoPrice = response.data['algorand']?.usd || 0;
      const crustPrice = response.data['crust-network']?.usd || 0;

      // Aggiorna la cache
      tokenPriceCache = {
        algo: algoPrice,
        crust: crustPrice,
        timestamp: now
      };

      console.log(`Token prices: ALGO = $${algoPrice}, CRUST = $${crustPrice}`);
      return { algoPrice, crustPrice };
    } catch (error) {
      // Gestione specifica per errore 429 (Too Many Requests)
      if (error.response && error.response.status === 429) {
        // Ottieni il valore dell'header Retry-After se presente
        const retryAfter = error.response.headers['retry-after'];
        const retrySeconds = retryAfter ? parseInt(retryAfter) : 60; // Default a 60 secondi se non specificato
        
        // Calcola quando possiamo fare la prossima richiesta
        nextAllowedFetchTime = now + (retrySeconds * 1000);
        
        // Aumenta il backoff per la prossima volta (max 30 minuti)
        currentBackoffTime = Math.min(currentBackoffTime * 2, 30 * 60 * 1000);
        
        console.log(`Rate limited by CoinGecko API. Need to wait ${retrySeconds} seconds before next request.`);
        console.log(`Next backoff time will be ${Math.floor(currentBackoffTime/1000)} seconds.`);
        
        // Se abbiamo prezzi in cache, usiamo quelli
        if (tokenPriceCache.algo && tokenPriceCache.crust) {
          console.log('Using cached token prices due to rate limit');
          return {
            algoPrice: tokenPriceCache.algo,
            crustPrice: tokenPriceCache.crust
          };
        }
      } else {
        console.error('Error fetching token prices:', error.message);
      }
      
      // Se abbiamo prezzi in cache, li usiamo
      if (tokenPriceCache.algo && tokenPriceCache.crust) {
        return {
          algoPrice: tokenPriceCache.algo,
          crustPrice: tokenPriceCache.crust
        };
      }
      // Altrimenti, utilizziamo valori predefiniti
      return { algoPrice: 0.15, crustPrice: 0.70 }; // Valori approssimativi come fallback
    }
  } catch (error) {
    console.error('Unexpected error in getTokenPrices:', error);
    // Se abbiamo prezzi in cache, usiamo quelli
    if (tokenPriceCache.algo && tokenPriceCache.crust) {
      return {
        algoPrice: tokenPriceCache.algo,
        crustPrice: tokenPriceCache.crust
      };
    }
    // Altrimenti, utilizziamo valori predefiniti
    return { algoPrice: 0.15, crustPrice: 0.70 }; // Valori approssimativi come fallback
  }
}

// Mock StorageOrderClient for the price estimation
// This simplifies the implementation since we don't need the full client functionality
class MockStorageOrderClient {
  constructor(basePrice, bytePrice, permanentMultiplier, algoPrice, crustPrice) {
    // Parameters based on testnet values or custom values
    this.basePrice = basePrice || DEFAULT_BASE_PRICE;
    this.bytePrice = bytePrice || DEFAULT_BYTE_PRICE;
    this.permanentMultiplier = permanentMultiplier || DEFAULT_PERMANENT_MULTIPLIER;
    this.algoPrice = algoPrice;
    this.crustPrice = crustPrice;
  }

  compose() {
    return {
      getPrice: ({ size, is_permanent }) => {
        return {
          atc: async () => {
            return {
              simulate: async () => {
                // Calculate price based on size and storage type
                const sizeInKB = Math.ceil(size / 1024);
                const basePrice = this.basePrice;
                const byteCost = sizeInKB * this.bytePrice;
                let totalPrice = basePrice + byteCost;
                
                // Debug per verificare il valore di is_permanent
                console.log('In MockStorageOrderClient, is_permanent:', is_permanent);
                console.log('typeof is_permanent:', typeof is_permanent);
                console.log('Base total price before multiplier:', totalPrice);
                
                // Apply multiplier for permanent storage
                if (is_permanent) {
                  totalPrice *= this.permanentMultiplier;
                  console.log('Applied permanent multiplier:', this.permanentMultiplier);
                } else {
                  console.log('No multiplier applied, using temporary storage');
                }
                
                // Se abbiamo i prezzi dei token, calcoliamo la conversione basata su valore reale
                if (this.algoPrice && this.crustPrice && this.algoPrice > 0 && this.crustPrice > 0) {
                  // Prima convertiamo il prezzo base da microALGO a ALGO
                  const priceInAlgos = totalPrice / 1000000;
                  
                  // Calcoliamo l'equivalente in USD del prezzo in ALGO
                  const priceInUSD = priceInAlgos * this.algoPrice;
                  
                  // Calcoliamo quanti CRUST corrispondono a questo valore in USD
                  const equivalentCRUST = priceInUSD / this.crustPrice;
                  
                  console.log(`Price conversions: ${priceInAlgos} ALGO = $${priceInUSD} = ${equivalentCRUST} CRUST`);
                  
                  // Il prezzo finale rimane in microALGO
                  console.log('Final total price in microALGO:', totalPrice);
                }
                
                return {
                  methodResults: [
                    {
                      returnValue: {
                        valueOf: () => totalPrice
                      }
                    }
                  ]
                };
              }
            };
          }
        };
      }
    };
  }
}

// Import the getPrice function from the example codebase
async function getPrice(algod, appClient, size, isPermanent = false) {
  try {
    console.log('getPrice called with isPermanent:', isPermanent);
    console.log('typeof isPermanent:', typeof isPermanent);
    
    const result = await (await appClient.compose().getPrice({ size, is_permanent: isPermanent }).atc()).simulate(algod);
    
    const price = result.methodResults[0].returnValue?.valueOf();
    console.log('Calculated price:', price);
    
    return price;
  } catch (error) {
    console.error('Error getting price:', error);
    throw error;
  }
}

// Home route
app.get('/', async (req, res) => {
  try {
    // Ottieni i prezzi attuali dei token
    const { algoPrice, crustPrice } = await getTokenPrices();
    
    res.render('index', {
      defaultBasePrice: DEFAULT_BASE_PRICE,
      defaultBytePrice: DEFAULT_BYTE_PRICE,
      defaultPermanentMultiplier: DEFAULT_PERMANENT_MULTIPLIER,
      algoPrice,
      crustPrice
    });
  } catch (error) {
    console.error('Error loading homepage:', error);
    res.render('index', {
      defaultBasePrice: DEFAULT_BASE_PRICE,
      defaultBytePrice: DEFAULT_BYTE_PRICE,
      defaultPermanentMultiplier: DEFAULT_PERMANENT_MULTIPLIER,
      algoPrice: null,
      crustPrice: null
    });
  }
});

// Calculate price route
app.post('/calculate-price', async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.files.file;
    const fileSize = file.size;
    
    // Debug per vedere esattamente cosa arriva dal client
    console.log('req.body.isPermanent:', req.body.isPermanent);
    console.log('typeof req.body.isPermanent:', typeof req.body.isPermanent);
    
    // Gestione migliorata per determinare se il checkbox è selezionato
    // Accetta qualsiasi valore truthy o la stringa 'true'
    const isPermanent = req.body.isPermanent === 'true' || 
                         req.body.isPermanent === 'on' || 
                         req.body.isPermanent === true;
    
    console.log('isPermanent after check:', isPermanent);
    
    // Get custom price parameters if provided
    const basePrice = parseInt(req.body.basePrice) || DEFAULT_BASE_PRICE;
    const bytePrice = parseInt(req.body.bytePrice) || DEFAULT_BYTE_PRICE;

    try {
      // Ottieni i prezzi attuali dei token
      const { algoPrice, crustPrice } = await getTokenPrices();
      
      // Use the mock client for price estimation with custom parameters
      const appClient = new MockStorageOrderClient(
        basePrice, 
        bytePrice, 
        DEFAULT_PERMANENT_MULTIPLIER,
        algoPrice,
        crustPrice
      );

      // Get the price
      const price = await getPrice(algodClient, appClient, fileSize, isPermanent);
      
      // Convert microAlgos to Algos for display
      const priceInAlgos = price / 1000000;
      
      // Return the calculation breakdown as well
      const sizeInKB = Math.ceil(fileSize / 1024);
      const byteCost = sizeInKB * bytePrice;
      const baseTotal = basePrice + byteCost;
      const permanentMultiplier = isPermanent ? DEFAULT_PERMANENT_MULTIPLIER : 1;
      
      // Calcola l'equivalente in CRUST
      let equivalentCRUST = null;
      if (algoPrice && crustPrice && algoPrice > 0 && crustPrice > 0) {
        const priceInUSD = priceInAlgos * algoPrice;
        equivalentCRUST = priceInUSD / crustPrice;
      }
      
      res.json({ 
        success: true, 
        fileSize,
        sizeInKB, 
        basePrice,
        bytePrice,
        byteCost,
        baseTotal,
        permanentMultiplier,
        price, 
        priceInAlgos,
        isPermanent,
        algoPrice,
        crustPrice,
        equivalentCRUST
      });
    } catch (error) {
      console.error('Error in price calculation:', error);
      res.status(500).json({ 
        error: 'Error calculating price', 
        message: error.message,
        fileSize 
      });
    }
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

// Endpoint per ottenere i prezzi aggiornati dei token
app.get('/api/token-prices', async (req, res) => {
  try {
    const { algoPrice, crustPrice } = await getTokenPrices();
    res.json({
      success: true,
      algoPrice,
      crustPrice,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error fetching token prices:', error);
    res.status(500).json({
      success: false,
      error: 'Could not fetch token prices',
      message: error.message
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  
  // Imposta un timer per aggiornare i prezzi dei token periodicamente
  console.log('Starting automatic token price updates every 2 minutes...');
  
  // Aggiorna subito i prezzi una prima volta
  getTokenPrices(true).then(({ algoPrice, crustPrice }) => {
    console.log(`Initial token prices: ALGO = $${algoPrice}, CRUST = $${crustPrice}`);
  }).catch(error => {
    console.error('Error fetching initial token prices:', error);
  });
  
  // Imposta l'aggiornamento periodico
  setInterval(() => {
    console.log('\n--- Scheduled token price update ---');
    getTokenPrices(true).then(({ algoPrice, crustPrice }) => {
      console.log(`Updated token prices: ALGO = $${algoPrice}, CRUST = $${crustPrice}`);
      console.log('--- End of scheduled update ---');
    }).catch(error => {
      console.error('Error in scheduled token price update:', error);
    });
  }, 2 * 60 * 1000); // 2 minuti
}); 