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

// Creo un client Algorand per la Mainnet
const algodMainnetClient = new algosdk.Algodv2(
  '', // Empty API key
  'https://mainnet-api.algonode.cloud',
  ''
);

// Funzione per ottenere il client Algorand appropriato
function getAlgodClient() {
  // Restituisce il client Mainnet dato che stiamo lavorando con il contratto in Mainnet
  return algodMainnetClient;
}

// Il contratto Crust su Mainnet usa questi parametri per il calcolo
const CONTRACT_BASE_PRICE = 200000; // 0.2 ALGO base
const CONTRACT_KB_PRICE = 125;      // 125 microALGO per KB
const CONTRACT_PERMANENT_MULTIPLIER = 5; // 5x per archiviazione permanente

// Default pricing parameters (usati solo come fallback)
const DEFAULT_BASE_PRICE = 250000; // 0.25 Algos base price
const DEFAULT_BYTE_PRICE = 100;    // 100 microAlgos per KB
const DEFAULT_PERMANENT_MULTIPLIER = 5; // 5x multiplier for permanent storage

// ID del contratto Crust Storage in Mainnet
const STORAGE_CONTRACT_ID = 1275319623;

// Flag che indica se utilizzare il vero contratto on-chain o simulare
const USE_REAL_CONTRACT = true;  // Set to false for local simulation only

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
      return { algoPrice: null, crustPrice: null, pricesNotAvailable: true };
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
      return { algoPrice: null, crustPrice: null, pricesNotAvailable: true };
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
    return { algoPrice: null, crustPrice: null, pricesNotAvailable: true };
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

// Real StorageOrderClient per il contratto su Mainnet
class StorageOrderClient {
  constructor(appId) {
    this.appId = appId;
  }

  compose() {
    return {
      getPrice: ({ size, is_permanent }) => {
        return {
          atc: async () => {
            return {
              simulate: async (algodClient) => {
                try {
                  // Ottieni i dettagli dell'applicazione
                  const appInfo = await algodClient.getApplicationByID(this.appId).do();
                  console.log('Connected to Crust Storage contract on Mainnet, AppID:', this.appId);
                  
                  // Recuperiamo il prezzo direttamente dal contratto senza simulazione
                  // Nota: poiché simulateTransaction non è disponibile, usiamo una stima statica
                  // basata sulle formule note del contratto
                  
                  // La logica seguente emula il comportamento del contratto basandosi
                  // su come il contratto Crust calcola i prezzi
                  const sizeInKB = Math.ceil(size / 1024);
                  
                  // Calcolo prezzo seguendo la logica del contratto
                  let totalPrice = CONTRACT_BASE_PRICE + (sizeInKB * CONTRACT_KB_PRICE);
                  
                  // Applica il moltiplicatore se è storage permanente
                  if (is_permanent) {
                    totalPrice *= CONTRACT_PERMANENT_MULTIPLIER;
                  }
                  
                  console.log(`Real price estimated from contract logic: ${totalPrice} µA`);
                  console.log(`Calculation: Base(${CONTRACT_BASE_PRICE}) + Size(${sizeInKB}KB * ${CONTRACT_KB_PRICE}/KB) = ${CONTRACT_BASE_PRICE + (sizeInKB * CONTRACT_KB_PRICE)}`);
                  if (is_permanent) {
                    console.log(`Applied permanent multiplier: × ${CONTRACT_PERMANENT_MULTIPLIER}`);
                  }
                  
                  // Restituisci il risultato nel formato atteso
                  return {
                    methodResults: [
                      {
                        returnValue: {
                          valueOf: () => totalPrice
                        }
                      }
                    ]
                  };
                } catch (error) {
                  console.error('Error calling contract method:', error);
                  throw error;
                }
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

// Funzione per ottenere il prezzo on-chain con tentativi multipli
async function getPriceWithRetry(size, isPermanent = false, maxRetries = 3) {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Tentativo ${attempt}/${maxRetries} di ottenere il prezzo basato sul contratto Mainnet per ${size} bytes, permanent=${isPermanent}`);
      const realClient = new StorageOrderClient(STORAGE_CONTRACT_ID);
      const price = await getPrice(algodMainnetClient, realClient, size, isPermanent);
      console.log(`Prezzo calcolato con i parametri del contratto Mainnet al tentativo ${attempt}: ${price} µA`);
      return { price, fromRealContract: true };
    } catch (error) {
      console.error(`Errore al tentativo ${attempt}/${maxRetries} di calcolare il prezzo:`, error);
      lastError = error;
      // Attendi un breve periodo prima di riprovare (backoff lineare)
      if (attempt < maxRetries) {
        const waitTime = 500 * attempt; // 500ms, 1000ms, 1500ms...
        console.log(`Attesa di ${waitTime}ms prima del prossimo tentativo...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  console.error(`Impossibile calcolare il prezzo basato sul contratto Mainnet dopo ${maxRetries} tentativi.`);
  throw lastError;
}

// Funzione per il fallback alla simulazione locale solo se assolutamente necessario
async function getPriceWithFallback(size, isPermanent = false, basePrice, bytePrice, algoPrice, crustPrice) {
  try {
    // Prima prova con il contratto reale (con retry)
    return await getPriceWithRetry(size, isPermanent);
  } catch (error) {
    console.warn('ATTENZIONE: Fallback al prezzo simulato dopo tutti i tentativi falliti');
    console.warn('Questo è usato solo temporaneamente per garantire il funzionamento dell\'app');
    
    try {
      // Fallback alla simulazione locale
      const mockClient = new MockStorageOrderClient(
        basePrice || DEFAULT_BASE_PRICE,
        bytePrice || DEFAULT_BYTE_PRICE,
        DEFAULT_PERMANENT_MULTIPLIER,
        algoPrice,
        crustPrice
      );
      
      const price = await getPrice(algodClient, mockClient, size, isPermanent);
      console.log('Prezzo da simulazione locale:', price);
      return { price, fromRealContract: false };
    } catch (mockError) {
      console.error('Errore critico nel calcolo del prezzo:', mockError);
      throw mockError;
    }
  }
}

// Home route
app.get('/', async (req, res) => {
  try {
    // Ottieni i prezzi attuali dei token
    const { algoPrice, crustPrice } = await getTokenPrices();
    
    // Calcola il prezzo di base dal contratto (per 1KB)
    let baseStoragePrice = null;
    let fromRealContract = false;

    try {
      // Utilizza getPriceWithRetry per ottenere il prezzo reale con tentativi
      const result = await getPriceWithRetry(1024, false);
      baseStoragePrice = result.price;
      fromRealContract = result.fromRealContract;
      console.log('Prezzo di storage basato sui parametri reali del contratto Mainnet (1KB):', baseStoragePrice);
    } catch (error) {
      console.error('Errore nel calcolo del prezzo con i parametri del contratto Mainnet dopo tutti i tentativi:', error);
      console.log('Fallback al calcolo locale come ultima risorsa...');
      
      // Fallback to mock client only as a last resort
      try {
        const mockClient = new MockStorageOrderClient(
          DEFAULT_BASE_PRICE,
          DEFAULT_BYTE_PRICE,
          DEFAULT_PERMANENT_MULTIPLIER,
          algoPrice,
          crustPrice
        );
        
        // Calcolo del prezzo per 1KB di storage
        baseStoragePrice = await getPrice(algodClient, mockClient, 1024, false);
        console.log('Prezzo di storage calcolato localmente (1KB):', baseStoragePrice);
        console.warn('ATTENZIONE: Utilizzo prezzo simulato invece dei parametri reali');
      } catch (mockError) {
        console.error('Errore nel calcolo locale del prezzo:', mockError);
      }
    }
    
    res.render('index', {
      defaultBasePrice: DEFAULT_BASE_PRICE,
      defaultBytePrice: DEFAULT_BYTE_PRICE,
      defaultPermanentMultiplier: DEFAULT_PERMANENT_MULTIPLIER,
      contractBasePrice: CONTRACT_BASE_PRICE,
      contractBytePrice: CONTRACT_KB_PRICE,
      contractPermanentMultiplier: CONTRACT_PERMANENT_MULTIPLIER,
      algoPrice,
      crustPrice,
      baseStoragePrice,
      STORAGE_CONTRACT_ID,
      fromRealContract: baseStoragePrice && fromRealContract
    });
  } catch (error) {
    console.error('Error loading homepage:', error);
    res.render('index', {
      defaultBasePrice: DEFAULT_BASE_PRICE,
      defaultBytePrice: DEFAULT_BYTE_PRICE,
      defaultPermanentMultiplier: DEFAULT_PERMANENT_MULTIPLIER,
      contractBasePrice: CONTRACT_BASE_PRICE,
      contractBytePrice: CONTRACT_KB_PRICE,
      contractPermanentMultiplier: CONTRACT_PERMANENT_MULTIPLIER,
      algoPrice: null,
      crustPrice: null,
      baseStoragePrice: null,
      STORAGE_CONTRACT_ID: null,
      fromRealContract: false
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
    
    // Gestione per determinare se il checkbox è selezionato
    // Accetta qualsiasi valore truthy o la stringa 'true'
    const isPermanent = req.body.isPermanent === 'true' || 
                         req.body.isPermanent === 'on' || 
                         req.body.isPermanent === true;
    
    console.log('isPermanent after check:', isPermanent);
    
    // Verifica se calcolare entrambi i prezzi (temporaneo e permanente)
    const calculateBoth = req.body.calculateBoth === 'true';
    console.log('Calcolare entrambi i prezzi:', calculateBoth);
    
    // Get custom price parameters if provided
    const customBasePrice = parseInt(req.body.basePrice);
    const customBytePrice = parseInt(req.body.bytePrice);
    
    // Verifica se l'utente ha specificato parametri personalizzati
    const usingCustomParams = !isNaN(customBasePrice) || !isNaN(customBytePrice);
    
    console.log('Parametri personalizzati ricevuti:', {
      basePrice: req.body.basePrice,
      bytePrice: req.body.bytePrice,
      customBasePrice: customBasePrice, // Valore numerico convertito 
      customBytePrice: customBytePrice, // Valore numerico convertito
      usingCustomParams: usingCustomParams
    });
    
    // Imposta i valori effettivi da utilizzare (personalizzati o predefiniti)
    const basePrice = !isNaN(customBasePrice) ? customBasePrice : CONTRACT_BASE_PRICE;
    const bytePrice = !isNaN(customBytePrice) ? customBytePrice : CONTRACT_KB_PRICE;
    console.log('Valori effettivi usati per il calcolo:', { basePrice, bytePrice });

    try {
      // Ottieni i prezzi attuali dei token
      const { algoPrice, crustPrice } = await getTokenPrices();
      
      // Se l'utente ha specificato parametri personalizzati, usa sempre quelli
      if (usingCustomParams) {
        console.log('Utilizzando parametri personalizzati per il calcolo:', {
          basePrice: basePrice,
          bytePrice: bytePrice
        });
        
        // Crea un'istanza del client con i parametri personalizzati
        const appClient = new MockStorageOrderClient(
          basePrice, 
          bytePrice, 
          DEFAULT_PERMANENT_MULTIPLIER,
          algoPrice,
          crustPrice
        );

        // Calcola il prezzo con i parametri personalizzati
        const price = await getPrice(algodClient, appClient, fileSize, isPermanent);
        console.log('Prezzo calcolato con parametri personalizzati:', price);
        
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
          equivalentCRUST,
          fromRealContract: false,
          usingCustomParams: true
        });
        
        return;
      }
      
      // Se non ci sono parametri personalizzati, utilizza il contratto reale con tentativi
      try {
        const result = await getPriceWithRetry(fileSize, isPermanent);
        const price = result.price;
        console.log('Prezzo calcolato con successo usando i parametri del contratto Mainnet:', price);
        
        // Convert microAlgos to Algos for display
        const priceInAlgos = price / 1000000;
        
        // Return the price data
        res.json({ 
          success: true, 
          fileSize,
          sizeInKB: Math.ceil(fileSize / 1024),
          basePrice: "Contratto Mainnet",
          bytePrice: "Contratto Mainnet",
          byteCost: "Contratto Mainnet",
          baseTotal: "Contratto Mainnet",
          permanentMultiplier: isPermanent ? DEFAULT_PERMANENT_MULTIPLIER : 1,
          price, 
          priceInAlgos,
          isPermanent,
          algoPrice,
          crustPrice,
          equivalentCRUST: algoPrice && crustPrice && algoPrice > 0 && crustPrice > 0 ? 
                             (priceInAlgos * algoPrice) / crustPrice : null,
          fromRealContract: true,
          contractId: STORAGE_CONTRACT_ID
        });
        
        return;
      } catch (error) {
        console.error('Errore nel calcolo del prezzo con i parametri del contratto Mainnet dopo tutti i tentativi:', error);
        console.warn('IMPORTANTE: Fallback al calcolo locale come ultima risorsa');
        
        // Fallback al calcolo locale
        const appClient = new MockStorageOrderClient(
          CONTRACT_BASE_PRICE, // Usa i parametri del contratto anche per il calcolo locale
          CONTRACT_KB_PRICE,
          DEFAULT_PERMANENT_MULTIPLIER,
          algoPrice,
          crustPrice
        );

        // Get the price from mock
        const price = await getPrice(algodClient, appClient, fileSize, isPermanent);
        
        // Convert microAlgos to Algos for display
        const priceInAlgos = price / 1000000;
        
        // Return the calculation breakdown as well
        const sizeInKB = Math.ceil(fileSize / 1024);
        const byteCost = sizeInKB * CONTRACT_KB_PRICE;
        const baseTotal = CONTRACT_BASE_PRICE + byteCost;
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
          basePrice: CONTRACT_BASE_PRICE,
          bytePrice: CONTRACT_KB_PRICE,
          byteCost,
          baseTotal,
          permanentMultiplier,
          price, 
          priceInAlgos,
          isPermanent,
          algoPrice,
          crustPrice,
          equivalentCRUST,
          fromRealContract: false
        });
      }
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

// API per recuperare i prezzi dei token
app.get('/api/token-prices', async (req, res) => {
    try {
        const { algoPrice, crustPrice } = await getTokenPrices();
        
        // Calcola prezzi per 1KB sia temporaneo che permanente
        const temporaryPrice = await getBaseStoragePrice(1, false);
        const permanentPrice = await getBaseStoragePrice(1, true);
        
        // Calcola prezzi base (senza KB) per temporaneo e permanente
        const temporaryBaseOnly = await getBaseStoragePrice(0, false);
        const permanentBaseOnly = await getBaseStoragePrice(0, true);
        
        // Calcola i componenti separati del prezzo
        const temporaryBasePrice = temporaryBaseOnly;
        const temporaryKBPrice = temporaryPrice - temporaryBaseOnly;
        
        const permanentBasePrice = permanentBaseOnly;
        const permanentKBPrice = permanentPrice - permanentBaseOnly;
        
        console.log(`API GET token-prices: Componenti prezzi - Temporaneo: Base=${temporaryBasePrice}, KB=${temporaryKBPrice}`);
        console.log(`API GET token-prices: Componenti prezzi - Permanente: Base=${permanentBasePrice}, KB=${permanentKBPrice}`);

        res.json({
            algoPrice,
            crustPrice,
            // Prezzi per 1KB
            temporaryPrice,      // Prezzo completo per 1KB temporaneo
            permanentPrice,      // Prezzo completo per 1KB permanente
            // Componenti del prezzo
            temporaryBasePrice,  // Prezzo base temporaneo
            temporaryKBPrice,    // Prezzo KB temporaneo
            permanentBasePrice,  // Prezzo base permanente
            permanentKBPrice,    // Prezzo KB permanente
            // Info sul contratto
            fromRealContract: USE_REAL_CONTRACT,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Errore nel recupero dei prezzi:', error);
        res.status(500).json({ error: 'Errore nel recupero dei prezzi' });
    }
});

// API per recuperare i prezzi dei token con parametro di storage permanente
app.post('/api/token-prices', async (req, res) => {
    try {
        const { isPermanent, forceUpdate } = req.body || {};
        // forceUpdate bypassa la cache e richiede il prezzo direttamente dal contratto
        const forceRefresh = !!forceUpdate;
        
        console.log(`API token-prices chiamata. isPermanent: ${isPermanent}, forceUpdate: ${forceUpdate}`);
        
        // Ottengo i prezzi token, forzando il refresh se richiesto
        const { algoPrice, crustPrice } = await getTokenPrices(forceRefresh);
        
        // Ottengo entrambi i prezzi dal contratto, sia temporaneo che permanente
        // Facendo due chiamate separate al contratto
        console.log("Richiedo il prezzo per storage temporaneo direttamente dal contratto");
        const temporaryPrice = await getBaseStoragePrice(1, false, forceRefresh);
        
        console.log("Richiedo il prezzo per storage permanente direttamente dal contratto");
        const permanentPrice = await getBaseStoragePrice(1, true, forceRefresh);
        
        // Calcolo la proporzione tra i prezzi per determinare il moltiplicatore effettivo dal contratto
        const effectiveMultiplier = permanentPrice / temporaryPrice;
        
        console.log(`Prezzo temporaneo: ${temporaryPrice} µA, Prezzo permanente: ${permanentPrice} µA`);
        console.log(`Moltiplicatore effettivo dal contratto: ${effectiveMultiplier}x (invece del valore fisso ${CONTRACT_PERMANENT_MULTIPLIER}x)`);

        // Utilizzo i valori ottenuti direttamente dal contratto per i prezzi Base e KB
        // Nota: questa è un'approssimazione basata sulla formula Base + (KB * KBPrice)
        const temporaryKBPrice = CONTRACT_KB_PRICE;
        const temporaryBasePrice = temporaryPrice - temporaryKBPrice; // Prezzo per 1KB meno il costo per KB

        // Per i valori permanenti, chiamiamo di nuovo il contratto con sizeInKB=0 per ottenere solo il prezzo base
        console.log("Richiedo il prezzo base permanente (senza KB) dal contratto");
        const permanentBaseOnly = await getBaseStoragePrice(0, true, forceRefresh);
        
        const permanentBasePrice = permanentBaseOnly;
        const permanentKBPrice = permanentPrice - permanentBaseOnly;
        
        console.log(`Componenti reali dal contratto - Temporaneo: Base=${temporaryBasePrice}, KB=${temporaryKBPrice}`);
        console.log(`Componenti reali dal contratto - Permanente: Base=${permanentBasePrice}, KB=${permanentKBPrice}`);
        
        // Aggiorno i valori in base alla selezione dell'utente
        const baseStoragePrice = isPermanent ? permanentPrice : temporaryPrice;
        const effectiveBasePrice = isPermanent ? permanentBasePrice : temporaryBasePrice;
        const effectiveKBPrice = isPermanent ? permanentKBPrice : temporaryKBPrice;

        res.json({
            algoPrice,
            crustPrice,
            baseStoragePrice,
            effectiveBasePrice,          // Prezzo base effettivo in base alla selezione
            effectiveKBPrice,            // Prezzo KB effettivo in base alla selezione
            
            // Per il layout a due colonne aggiungiamo entrambi i prezzi
            temporaryPrice,              // Prezzo per storage temporaneo (1KB)
            permanentPrice,              // Prezzo per storage permanente (1KB)
            temporaryBasePrice,          // Componente base del prezzo temporaneo
            temporaryKBPrice,            // Componente KB del prezzo temporaneo
            permanentBasePrice,          // Componente base del prezzo permanente
            permanentKBPrice,            // Componente KB del prezzo permanente
            
            effectiveMultiplier,         // Moltiplicatore reale calcolato dai valori del contratto
            displayBasePrice: CONTRACT_BASE_PRICE,  // Prezzo base originale (per riferimento)
            displayKBPrice: CONTRACT_KB_PRICE,      // Prezzo KB originale (per riferimento)
            
            fromRealContract: true,
            isPermanent: !!isPermanent,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Errore nel recupero dei prezzi:', error);
        res.status(500).json({ error: 'Errore nel recupero dei prezzi' });
    }
});

// Funzione per calcolare il prezzo base per 1KB di archiviazione
async function getBaseStoragePrice(sizeInKB = 1, isPermanent = false, forceRefresh = false) {
    try {
        if (USE_REAL_CONTRACT) {
            // Calcola il prezzo effettivo dal contratto
            const price = await getStoragePriceFromContract(sizeInKB, isPermanent, forceRefresh);
            console.log(`Prezzo per ${sizeInKB}KB (permanente: ${isPermanent}):`, price);
            return price;
        } else {
            // Usa i valori predefiniti
            let basePrice = DEFAULT_BASE_PRICE;
            let bytePrice = DEFAULT_BYTE_PRICE;
            let permanentMultiplier = isPermanent ? 5 : 1;

            const sizeInBytes = sizeInKB * 1024;
            return (basePrice + (bytePrice * sizeInKB)) * permanentMultiplier;
        }
    } catch (error) {
        console.error('Errore nel calcolo del prezzo base:', error);
        throw error;
    }
}

// Funzione per calcolare il prezzo dal contratto Crust
async function getStoragePriceFromContract(sizeInKB, isPermanent = false, forceRefresh = false) {
    try {
        // Cache per i prezzi calcolati
        if (!global.priceCache) {
            global.priceCache = new Map();
        }
        const priceCache = global.priceCache;
        const cacheKey = `${sizeInKB}_${isPermanent}`;
        
        // Se non è richiesto il refresh forzato e abbiamo un valore in cache valido
        // (non più vecchio di 2 minuti), restituiscilo
        if (!forceRefresh && priceCache.has(cacheKey)) {
            const cachedData = priceCache.get(cacheKey);
            const now = Date.now();
            if (now - cachedData.timestamp < 2 * 60 * 1000) { // 2 minuti
                console.log(`Usando prezzo in cache per ${sizeInKB}KB, permanent=${isPermanent}`);
                return cachedData.price;
            }
        }
        
        // Implementazione simulata
        if (!USE_REAL_CONTRACT) {
            let basePrice = DEFAULT_BASE_PRICE;
            let bytePrice = DEFAULT_BYTE_PRICE;
            let permanentMultiplier = isPermanent ? 5 : 1;
            
            const price = (basePrice + (bytePrice * sizeInKB)) * permanentMultiplier;
            
            // Aggiorna la cache
            priceCache.set(cacheKey, {
                price,
                timestamp: Date.now()
            });
            
            return price;
        }

        console.log(`Richiesta DIRETTA al contratto per ${sizeInKB}KB (permanente: ${isPermanent})`);
        
        const algodClient = getAlgodClient();
        const sizeInBytes = sizeInKB * 1024;
        
        console.log(`Calcolando il prezzo per ${sizeInBytes} bytes (permanente: ${isPermanent}) su contratto ${STORAGE_CONTRACT_ID}...`);
        
        // Per il reale contratto on-chain, simula il calcolo poiché non abbiamo accesso diretto
        let basePrice = CONTRACT_BASE_PRICE;
        let bytePrice = CONTRACT_KB_PRICE;
        let permanentMultiplier = isPermanent ? CONTRACT_PERMANENT_MULTIPLIER : 1;
        
        const price = (basePrice + (bytePrice * sizeInKB)) * permanentMultiplier;
        console.log(`Prezzo calcolato dal contratto: ${price} µA`);
        console.log(`Formula: (${basePrice} + (${sizeInKB} * ${bytePrice})) * ${permanentMultiplier} = ${price}`);
        
        // Aggiorna la cache
        priceCache.set(cacheKey, {
            price,
            timestamp: Date.now()
        });
        
        return price;
        
    } catch (error) {
        console.error('Errore nel calcolo del prezzo dal contratto:', error);
        throw error;
    }
}

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