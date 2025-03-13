document.addEventListener('DOMContentLoaded', function() {
    const uploadForm = document.getElementById('uploadForm');
    const resultsDiv = document.getElementById('results');
    const errorDiv = document.getElementById('error');
    const loadingDiv = document.getElementById('loading');
    const customParamsSection = document.getElementById('customParamsSection');
    
    // Flag per verificare se è il primo calcolo
    let isFirstCalculation = true;
    
    // Result display elements
    const fileSizeSpan = document.getElementById('fileSize');
    const storageTypeSpan = document.getElementById('storageType');
    const priceInMicroAlgosSpan = document.getElementById('priceInMicroAlgos');
    const priceInAlgosSpan = document.getElementById('priceInAlgos');
    const errorMessageP = document.getElementById('errorMessage');
    const crustEquivalentDiv = document.getElementById('crustEquivalent');
    const equivalentCRUSTSpan = document.getElementById('equivalentCRUST');
    
    // Calculation details elements
    const sizeInKBSpan = document.getElementById('sizeInKB');
    const basePriceResultSpan = document.getElementById('basePriceResult');
    const bytePriceSpan = document.getElementById('bytePrice');
    const byteCostSpan = document.getElementById('byteCost');
    const baseTotalSpan = document.getElementById('baseTotal');
    const permanentMultiplierSpan = document.getElementById('permanentMultiplier');
    
    // Price parameter sliders
    const basePriceInput = document.getElementById('basePrice');
    const basePriceValueSpan = document.getElementById('basePriceValue');
    const bytePriceInput = document.getElementById('bytePrice');
    const bytePriceValueSpan = document.getElementById('bytePriceValue');
    
    // Real-time updating of slider values
    basePriceInput.addEventListener('input', function() {
        basePriceValueSpan.textContent = this.value;
    });
    
    bytePriceInput.addEventListener('input', function() {
        bytePriceValueSpan.textContent = this.value;
    });
    
    // Calculate price client-side for preview (simulated)
    const fileInput = document.getElementById('file');
    const isPermanentCheckbox = document.getElementById('isPermanent');
    
    // Function to update price preview when parameters change
    function updatePricePreview() {
        if (!fileInput.files || !fileInput.files[0]) return;
        
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
            bytePriceSpan.textContent = bytePrice;
            byteCostSpan.textContent = byteCost.toLocaleString();
            baseTotalSpan.textContent = baseTotal.toLocaleString();
            permanentMultiplierSpan.textContent = permanentMultiplier;
            
            // Update the total prices
            priceInMicroAlgosSpan.textContent = totalPrice.toLocaleString();
            priceInAlgosSpan.textContent = (totalPrice / 1000000).toLocaleString(undefined, {
                minimumFractionDigits: 6,
                maximumFractionDigits: 6
            }) + " ALGO";
            
            // Mostra l'equivalente in CRUST se disponibile
            if (data.equivalentCRUST) {
                equivalentCRUSTSpan.textContent = data.equivalentCRUST.toFixed(6);
                crustEquivalentDiv.style.display = 'block';
            } else {
                crustEquivalentDiv.style.display = 'none';
            }
        }
    }
    
    // Funzione per calcolare il prezzo
    async function calculatePrice(showLoading = true) {
        if (!fileInput.files || !fileInput.files[0]) {
            alert('Seleziona un file per stimare il costo.');
            return;
        }
        
        if (showLoading) {
            // Reset display
            resultsDiv.style.display = 'none';
            errorDiv.style.display = 'none';
            loadingDiv.style.display = 'block';
        }
        
        // Get form data
        const formData = new FormData(uploadForm);
        
        // Assicuriamoci che il valore del checkbox venga trasmesso correttamente
        // FormData non include checkbox deselezionati, quindi dobbiamo essere espliciti
        const isPermanent = isPermanentCheckbox.checked;
        formData.set('isPermanent', isPermanent ? 'true' : 'false');
        
        // Debug
        console.log('Checkbox checked:', isPermanent);
        console.log('FormData isPermanent:', formData.get('isPermanent'));
        
        try {
            const response = await fetch('/calculate-price', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.error) {
                // Display error
                errorMessageP.textContent = data.message || data.error;
                errorDiv.style.display = 'block';
            } else {
                // Format the file size for display
                const formattedSize = formatFileSize(data.fileSize);
                fileSizeSpan.textContent = formattedSize;
                
                // Display storage type
                storageTypeSpan.textContent = data.isPermanent ? 'Permanente' : 'Temporanea';
                
                // Display prices
                priceInMicroAlgosSpan.textContent = data.price.toLocaleString();
                priceInAlgosSpan.textContent = (data.priceInAlgos).toLocaleString(undefined, {
                    minimumFractionDigits: 6,
                    maximumFractionDigits: 6
                }) + " ALGO";
                
                // Mostra l'equivalente in CRUST se disponibile
                if (data.equivalentCRUST) {
                    equivalentCRUSTSpan.textContent = data.equivalentCRUST.toFixed(6);
                    crustEquivalentDiv.style.display = 'block';
                } else {
                    crustEquivalentDiv.style.display = 'none';
                }
                
                // Display calculation details
                sizeInKBSpan.textContent = data.sizeInKB.toLocaleString();
                basePriceResultSpan.textContent = data.basePrice.toLocaleString();
                bytePriceSpan.textContent = data.byteCost.toLocaleString();
                baseTotalSpan.textContent = data.baseTotal.toLocaleString();
                permanentMultiplierSpan.textContent = data.permanentMultiplier;
                
                // Show results
                resultsDiv.style.display = 'block';
                
                // Se è il primo calcolo, mostra i parametri personalizzati
                if (isFirstCalculation) {
                    customParamsSection.style.display = 'block';
                    isFirstCalculation = false;
                }
            }
        } catch (error) {
            // Display error
            console.error('Error:', error);
            errorMessageP.textContent = 'Errore nel calcolo. Riprova.';
            errorDiv.style.display = 'block';
        } finally {
            // Hide loading
            if (showLoading) {
                loadingDiv.style.display = 'none';
            }
        }
    }
    
    // Add event listeners to all parameters for real-time preview
    fileInput.addEventListener('change', function() {
        // Reset custom params if file is changed
        if (!isFirstCalculation) {
            updatePricePreview();
        }
    });
    
    isPermanentCheckbox.addEventListener('change', function() {
        if (!isFirstCalculation) {
            updatePricePreview();
        }
    });
    
    basePriceInput.addEventListener('input', updatePricePreview);
    bytePriceInput.addEventListener('input', updatePricePreview);
    
    // Form submission for accurate server-side calculation
    uploadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        calculatePrice();
    });
    
    // Function to format file size
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        
        return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + units[i];
    }
}); 