document.addEventListener('DOMContentLoaded', function() {
    // Main UI elements
    const uploadForm = document.getElementById('uploadForm');
    const resultsDiv = document.getElementById('results');
    const errorDiv = document.getElementById('error');
    const loadingDiv = document.getElementById('loading');
    const advancedAccordion = document.getElementById('advancedAccordion');
    
    // File upload elements
    const fileInput = document.getElementById('file');
    const dropzone = document.getElementById('dropzone');
    const selectedFile = document.querySelector('.selected-file');
    const fileName = document.querySelector('.file-name');
    const fileSize = document.querySelector('.file-size');
    const uploadContent = document.querySelector('.upload-content');
    
    // Storage options elements
    const isPermanentCheckbox = document.getElementById('isPermanent');
    const multiplierRow = document.getElementById('multiplierRow');
    
    // Result display elements
    const fileSizeSpan = document.getElementById('fileSize');
    const storageTypeSpan = document.getElementById('storageType');
    const priceInMicroAlgosSpan = document.getElementById('priceInMicroAlgos');
    const priceInAlgosSpan = document.getElementById('priceInAlgos');
    const errorMessageP = document.getElementById('errorMessage');
    const crustEquivalentDiv = document.getElementById('crustEquivalent');
    const equivalentCRUSTSpan = document.getElementById('equivalentCRUST');
    const onChainIndicator = document.getElementById('onChainIndicator');
    
    // Calculation details elements
    const sizeInKBSpan = document.getElementById('sizeInKB');
    const basePriceResultSpan = document.getElementById('basePriceResult');
    const byteCostSpan = document.getElementById('byteCost');
    const permanentMultiplierSpan = document.getElementById('permanentMultiplier');
    
    // Price parameter sliders
    const basePriceInput = document.getElementById('basePrice');
    const basePriceValueSpan = document.getElementById('basePriceValue');
    const bytePriceInput = document.getElementById('bytePrice');
    const bytePriceValueSpan = document.getElementById('bytePriceValue');
    
    // Flag to track if this is the first calculation
    let isFirstCalculation = true;
    
    // Initialize tooltips
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
    
    // Setup File Upload interactions
    if (fileInput && dropzone) {
        // File input change handler
        fileInput.addEventListener('change', function() {
            handleFileSelection(this.files);
        });
        
        // Drag and drop handlers
        dropzone.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.classList.add('dragover');
        });
        
        dropzone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            this.classList.remove('dragover');
        });
        
        dropzone.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                handleFileSelection(e.dataTransfer.files);
            }
        });
        
        // Explicit click handler for the dropzone
        dropzone.addEventListener('click', function() {
            fileInput.click();
        });
    }
    
    // Handle file selection from input or drop
    function handleFileSelection(files) {
        if (files && files[0]) {
            const file = files[0];
            // Update file input
            fileInput.files = files;
            
            // Show file details
            if (selectedFile && fileName && fileSize) {
                fileName.textContent = file.name;
                fileSize.textContent = formatFileSize(file.size);
                selectedFile.style.display = 'flex';
                
                if (uploadContent) {
                    uploadContent.classList.add('has-file');
                }
            }
            
            // Auto-submit the form if a file is selected and this is the first time
            if (isFirstCalculation && uploadForm) {
                // Wait a brief moment to allow the UI to update
                setTimeout(() => {
                    calculatePrice();
                }, 500);
            }
        } else {
            // Reset file selection UI
            if (selectedFile) {
                selectedFile.style.display = 'none';
            }
            if (uploadContent) {
                uploadContent.classList.remove('has-file');
            }
        }
    }
    
    // Real-time updating of slider values
    if (basePriceInput && basePriceValueSpan) {
        basePriceInput.addEventListener('input', function() {
            basePriceValueSpan.textContent = this.value;
            updatePricePreview();
        });
    }
    
    if (bytePriceInput && bytePriceValueSpan) {
        bytePriceInput.addEventListener('input', function() {
            bytePriceValueSpan.textContent = this.value;
            updatePricePreview();
        });
    }
    
    // Update the permanent storage multiplier visibility
    if (isPermanentCheckbox) {
        isPermanentCheckbox.addEventListener('change', function() {
            updatePricePreview();
        });
    }
    
    // Calculate price client-side for preview (simulated)
    function updatePricePreview() {
        if (!fileInput || !fileInput.files || !fileInput.files[0]) return;
        
        const fileSize = fileInput.files[0].size;
        const isPermanent = isPermanentCheckbox.checked;
        const basePrice = parseInt(basePriceInput.value);
        const bytePrice = parseInt(bytePriceInput.value);
        
        // Preview calculation
        const sizeInKB = Math.ceil(fileSize / 1024);
        const byteCost = sizeInKB * bytePrice;
        const baseTotal = basePrice + byteCost;
        const permanentMultiplier = isPermanent ? 5 : 1;
        const totalPrice = baseTotal * permanentMultiplier;
        
        // If results are already displayed, update them
        if (resultsDiv.style.display === 'block') {
            // Update all the price details
            sizeInKBSpan.textContent = sizeInKB.toLocaleString();
            basePriceResultSpan.textContent = basePrice.toLocaleString();
            byteCostSpan.textContent = byteCost.toLocaleString();
            
            // Show or hide the multiplier row
            if (multiplierRow) {
                permanentMultiplierSpan.textContent = permanentMultiplier;
                multiplierRow.style.display = permanentMultiplier > 1 ? 'flex' : 'none';
            }
            
            // Update the total prices
            priceInMicroAlgosSpan.textContent = totalPrice.toLocaleString();
            priceInAlgosSpan.textContent = (totalPrice / 1000000).toLocaleString(undefined, {
                minimumFractionDigits: 6,
                maximumFractionDigits: 6
            }) + " ALGO";
            
            // Update storage type badge
            if (storageTypeSpan) {
                storageTypeSpan.textContent = isPermanent ? 'Permanente' : 'Temporanea';
                storageTypeSpan.className = 'badge ' + (isPermanent ? 'bg-warning text-dark' : 'bg-primary');
            }
            
            // This is a custom calculation, so hide the on-chain indicator
            if (onChainIndicator) {
                onChainIndicator.style.display = 'none';
            }
            
            // Update CRUST equivalent if we have price data
            updateCrustEquivalent(totalPrice / 1000000);
        }
    }
    
    // Update the CRUST equivalent amount based on current token prices
    function updateCrustEquivalent(algoAmount) {
        const algoPrice = parseFloat(document.getElementById('algoPrice').textContent);
        const crustPrice = parseFloat(document.getElementById('crustPrice').textContent);
        
        if (algoPrice > 0) {
            // Calcola il valore in USD
            const usdValue = algoAmount * algoPrice;
            
            // Aggiorna l'equivalente in USD
            const equivalentUSDElement = document.getElementById('equivalentUSD');
            if (equivalentUSDElement) {
                equivalentUSDElement.textContent = '$' + usdValue.toFixed(2);
            }
            
            // Calcola e aggiorna l'equivalente in EUR
            const eurUsdRate = 0.92; // Tasso di conversione approssimativo EUR/USD
            const eurValue = usdValue * eurUsdRate;
            const equivalentEURElement = document.getElementById('equivalentEUR');
            if (equivalentEURElement) {
                equivalentEURElement.textContent = '€' + eurValue.toFixed(2);
            }
            
            // Aggiorna l'equivalente in CRUST
            if (crustPrice > 0) {
                const crustAmount = usdValue / crustPrice;
                const equivalentCRUSTElement = document.getElementById('equivalentCRUST');
                if (equivalentCRUSTElement) {
                    equivalentCRUSTElement.textContent = crustAmount.toFixed(6);
                }
            }
        }
    }
    
    // Funzione per aggiornare i prezzi
    function updateTokenPrices(forceUpdate = false) {
        // Ottieni lo stato del toggle di storage permanente
        const isPermanentCheckbox = document.getElementById('isPermanent');
        const isPermanent = isPermanentCheckbox ? isPermanentCheckbox.checked : false;
        
        console.log("Aggiornamento prezzi. Permanent:", isPermanent, "Force update:", forceUpdate);
        
        fetch('/api/token-prices', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                isPermanent: isPermanent,
                forceUpdate: forceUpdate 
            })
        })
        .then(response => response.json())
        .then(data => {
            document.getElementById('algoPrice').textContent = data.algoPrice.toFixed(4);
            document.getElementById('crustPrice').textContent = data.crustPrice.toFixed(4);
            
            const storagePriceElement = document.getElementById('storagePrice');
            if (storagePriceElement && data.baseStoragePrice) {
                // Salva il valore precedente per verificare se è cambiato
                const oldPrice = storagePriceElement.textContent;
                const newPrice = data.baseStoragePrice.toLocaleString() + ' µA';
                
                storagePriceElement.textContent = newPrice;
                
                // Effetto visivo solo se il prezzo è cambiato
                if (oldPrice !== newPrice || forceUpdate) {
                    highlightElement(storagePriceElement);
                }
            } else if (storagePriceElement) {
                storagePriceElement.textContent = 'Caricamento...';
            }
            
            // Aggiorna anche gli equivalenti nel risultato se visibile
            updateEquivalents();
            
            // Aggiorna l'indicatore di Mainnet
            const mainnetIndicator = document.getElementById('mainnetIndicator');
            if (mainnetIndicator) {
                mainnetIndicator.style.display = data.fromRealContract ? '' : 'none';
            }
        })
        .catch(error => {
            console.error('Errore nel recupero dei prezzi dei token:', error);
        });
    }
    
    // Function to calculate the price from the server
    async function calculatePrice(showLoading = true) {
        try {
            if (showLoading) {
                document.getElementById('loading').style.display = 'block';
                document.getElementById('error').style.display = 'none';
                document.getElementById('results').style.display = 'none';
            }

            const formData = new FormData(document.getElementById('uploadForm'));
            
            // Aggiungi il parametro isPermanent alla richiesta
            const isPermanentCheckbox = document.getElementById('isPermanent');
            if (isPermanentCheckbox && isPermanentCheckbox.checked) {
                formData.append('isPermanent', 'true');
            }
            
            const customBasePrice = document.getElementById('basePrice').value;
            const customBytePrice = document.getElementById('bytePrice').value;
            
            // Aggiungi i valori personalizzati
            formData.append('customBasePrice', customBasePrice);
            formData.append('customBytePrice', customBytePrice);

            const response = await fetch('/api/calculate-price', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Errore nella risposta del server');
            }

            const data = await response.json();
            
            // Aggiorna i risultati
            document.getElementById('fileSize').textContent = data.fileSize;
            document.getElementById('sizeInKB').textContent = `${data.sizeInKB.toLocaleString()} KB`;
            document.getElementById('priceInAlgos').textContent = `${data.priceInAlgos.toLocaleString()} ALGO`;
            document.getElementById('priceInMicroAlgos').textContent = data.priceInMicroAlgos.toLocaleString();
            document.getElementById('basePriceResult').textContent = `${data.basePrice.toLocaleString()} µA`;
            document.getElementById('byteCost').textContent = `${data.byteCost.toLocaleString()} µA`;
            
            // Aggiorna i dati dell'archiviazione permanente
            const storageType = document.getElementById('storageType');
            const multiplierRow = document.getElementById('multiplierRow');
            const permanentMultiplier = document.getElementById('permanentMultiplier');
            
            if (data.isPermanent) {
                storageType.textContent = 'Permanente';
                storageType.className = 'badge permanent-badge';
                if (multiplierRow) multiplierRow.style.display = 'flex';
                if (permanentMultiplier) permanentMultiplier.textContent = data.permanentMultiplier;
            } else {
                storageType.textContent = 'Temporaneo';
                storageType.className = 'badge temporary-badge';
                if (multiplierRow) multiplierRow.style.display = 'none';
            }
            
            // Aggiorna l'indicatore on-chain
            const onChainIndicator = document.getElementById('onChainIndicator');
            if (data.fromRealContract) {
                onChainIndicator.style.display = 'block';
            } else {
                onChainIndicator.style.display = 'none';
            }
            
            // Visualizza il risultato e nascondi il caricamento
            document.getElementById('results').style.display = 'block';
            document.getElementById('loading').style.display = 'none';
            
            // Aggiorna gli equivalenti
            updateCrustEquivalent(data.priceInAlgos);
        } catch (error) {
            console.error('Errore nel calcolo del prezzo:', error);
            document.getElementById('errorMessage').textContent = error.message || 'Si è verificato un errore durante il calcolo.';
            document.getElementById('error').style.display = 'block';
            document.getElementById('loading').style.display = 'none';
        }
    }
    
    // Funzione per evidenziare visivamente i parametri quando cambiano
    function highlightElement(element) {
        if (!element) return;
        
        // Rimuovi l'evidenziazione precedente
        element.classList.remove('price-updated');
        
        // Forza un reflow del DOM per assicurarsi che l'animazione venga riapplicata
        void element.offsetWidth;
        
        // Aggiungi la classe per l'animazione
        element.classList.add('price-updated');
        
        // Rimuovi la classe dopo l'animazione
        setTimeout(() => {
            element.classList.remove('price-updated');
        }, 1000);
    }
    
    // Form submission handler
    if (uploadForm) {
        uploadForm.addEventListener('submit', function(e) {
            e.preventDefault();
            calculatePrice();
        });
    }
    
    // Show notification helper function
    function showNotification(message, type = 'info') {
        if (!errorDiv || !errorMessageP) return;
        
        errorMessageP.textContent = message;
        errorDiv.className = `alert alert-${type} mt-4`;
        errorDiv.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }
    
    // Function to format file size
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        
        return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + units[i];
    }
    
    // Token price update countdown
    const priceUpdateCountdown = document.getElementById('priceUpdateCountdown');
    if (priceUpdateCountdown) {
        let countdownValue = 120;
        
        const countdownInterval = setInterval(() => {
            countdownValue--;
            priceUpdateCountdown.textContent = countdownValue;
            
            if (countdownValue <= 0) {
                updateTokenPrices();
                countdownValue = 120; // Reset countdown
            }
        }, 1000);
        
        // Initial update
        updateTokenPrices();
    }
}); 