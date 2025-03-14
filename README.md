# Crust Examples

Questa repository contiene esempi di integrazione con il protocollo di archiviazione Crust su blockchain Algorand. Il progetto fornisce strumenti e applicazioni per interagire con il sistema di archiviazione decentralizzata, consentendo di caricare file su IPFS e gestire ordini di archiviazione tramite smart contract Algorand.

## Demo Online

Puoi provare l'applicazione Storage Price Estimator online qui: [https://storage-price-estimator.vercel.app/](https://storage-price-estimator.vercel.app/)

## Struttura della Repository

- **typescript/**: Implementazione client in TypeScript
  - `src/StorageOrderClient.ts`: Client completo per interagire con il contratto di archiviazione
  - `src/index.ts`: Esempio di utilizzo delle API per caricare file e ordinare archiviazione
- **application.json**: Specifiche dell'applicazione e metodi ABI disponibili
- **storage-price-estimator/**: Applicazione web per stimare i costi di archiviazione

## Client TypeScript

La directory `typescript/` contiene un client TypeScript completo per interagire con il contratto di archiviazione su Algorand. Include funzionalità come:

- **Autenticazione Web3**: Generazione di header di autenticazione per interazioni sicure
- **Upload su IPFS**: Caricamento di file su IPFS con verifica dell'integrità
- **Calcolo Prezzi**: Ottenere il prezzo di archiviazione in base alla dimensione del file
- **Gestione Ordini**: Effettuare ordini di archiviazione con supporto per archiviazione permanente o temporanea

### Esecuzione del Client TypeScript

```bash
cd typescript
npm install
# Modifica il file index.ts se necessario
npm start
```

## Storage Price Estimator

Nella directory `storage-price-estimator/` è disponibile un'applicazione web che permette di stimare il costo di archiviazione dei file sulla blockchain Algorand tramite un'interfaccia utente intuitiva.

### Caratteristiche

- **Interfaccia Modern UI/UX**: Design reattivo e ottimizzato per dispositivi mobili
- **Upload di File**: Supporto per trascinamento (drag & drop) e selezione tramite dialog
- **Stima Immediata**: Calcolo dei costi in tempo reale
- **Visualizzazione Multimoneta**: Prezzi in ALGO, CRUST, USD ed EUR
- **Opzioni Avanzate**: Personalizzazione dei parametri di calcolo
- **Tooltips Informativi**: Guida contestuale per gli utenti

### Miglioramenti Recenti

- **Tooltip Interattivi**: Aggiunti tooltip in tutti i componenti principali per migliorare l'esperienza utente
- **Gestione Upload File Migliorata**: Risolti problemi con la selezione dei file e migliorato feedback all'utente
- **Range Slider Estesi**: Aumentati i valori massimi per i parametri avanzati per supportare scenari di pricing più flessibili
- **Aggiornamento Tab Permanente/Temporaneo**: Migliorata la visualizzazione dei dettagli di calcolo quando si cambia tipo di archiviazione
- **Gestione Errori Avanzata**: Migliorati i messaggi di errore per facilitare la risoluzione dei problemi

### Installazione e Avvio dell'Applicazione

#### Prerequisiti

Prima di iniziare, assicurati di avere installato:

- **Node.js** (versione 14.x o superiore)
- **npm** (normalmente installato con Node.js)
- **Git** (per clonare il repository)

#### Passaggi per l'Installazione

1. **Clona il repository** (se non l'hai già fatto):
   ```bash
   git clone https://github.com/Andrea0xeth/crust-examples.git
   cd crust-examples
   ```

2. **Naviga nella directory dell'applicazione**:
   ```bash
   cd storage-price-estimator
   ```

3. **Installa le dipendenze**:
   ```bash
   npm install
   ```

#### Opzioni di Avvio

Puoi avviare l'applicazione in diverse modalità:

1. **Modalità Produzione**:
   ```bash
   npm start
   ```
   L'applicazione sarà disponibile all'indirizzo [http://localhost:3000](http://localhost:3000)

2. **Modalità Sviluppo** (con riavvio automatico):
   ```bash
   npm run dev
   ```
   Questa modalità riavvia automaticamente il server quando vengono apportate modifiche ai file.

3. **Specificare una porta diversa**:
   ```bash
   PORT=8080 npm start
   ```
   Questo comando avvia l'applicazione sulla porta 8080 anziché 3000.

#### Verifica dell'Installazione

Per verificare che l'applicazione sia in esecuzione correttamente:

1. Apri il browser all'indirizzo indicato (default: [http://localhost:3000](http://localhost:3000))
2. Dovrebbe apparire l'interfaccia dello Storage Price Estimator
3. Prova a caricare un file per verificare che il calcolo dei prezzi funzioni correttamente

#### Risoluzione dei Problemi

Se riscontri problemi durante l'installazione o l'avvio:

- **Errore "Cannot find module"**: Assicurati di aver eseguito `npm install` nella directory corretta
- **Errore di porta in uso**: Cambia la porta utilizzando la variabile d'ambiente `PORT`
- **Problemi di connessione API**: Verifica che la tua connessione internet sia attiva e che non ci siano blocchi del firewall
- **Errori di visualizzazione nel browser**: Prova a cancellare la cache del browser o utilizza la modalità di navigazione in incognito

Per problemi più specifici, consulta la sezione Issues del repository GitHub.

## Specifiche Tecniche

### Architettura del Storage Price Estimator

- **Frontend**: HTML5, CSS3, JavaScript (ES6+), Bootstrap 5
- **Backend**: Node.js, Express.js
- **Template Engine**: EJS
- **Integrazione Blockchain**: AlgoSDK, AlgoKit
- **API**: Integrazione con CoinGecko per prezzi token in tempo reale

### Algoritmo di Calcolo Prezzi

Il prezzo di archiviazione è calcolato secondo la seguente formula:

```
sizeInKB = ceiling(size / 1024)
byteCost = sizeInKB * bytePrice
totalPrice = basePrice + byteCost

if (isPermanent) {
    totalPrice *= permanentMultiplier
}
```

Dove:
- `basePrice`: Prezzo base fisso (in microALGO)
- `bytePrice`: Prezzo per KB (in microALGO)
- `permanentMultiplier`: Moltiplicatore per archiviazione permanente (default: 5)

### Funzioni Core del Client TypeScript

#### Ottenere il Prezzo di Archiviazione

```javascript
/**
 * Gets the required price to store a file of a given size
 *
 * @param algod Algod client to use to simulate the ABI method call
 * @param appClient App client to use to compose the ABI method call
 * @param size Size of the file
 * @param isPermanent Whether the file should be added to the renewal pool
 * @returns Price, in uALGO, to store the file
 */
async function getPrice(algod, appClient, size, isPermanent = false) {
    const result = await (await appClient.compose().getPrice({ size, is_permanent: isPermanent }).atc()).simulate(algod)
    return result.methodResults[0].returnValue?.valueOf() as number
}
```

#### Effettuare un Ordine di Archiviazione

```javascript
/**
 * Places a storage order for a CID
 *
 * @param algod Algod client used to get transaction params
 * @param appClient App client used to call the storage app
 * @param account Account used to send the transactions
 * @param cid CID of the file
 * @param size Size of the file
 * @param price Price, in uALGO, to store the file
 * @param isPermanent Whether the file should be added to the renewal pool
 */
async function placeOrder(
    algod, appClient, account, cid, size, price, isPermanent
) {
    const merchant = await getOrderNode(algod, appClient)
    const seed = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from: account.addr,
        to: (await appClient.appClient.getAppReference()).appAddress,
        amount: price,
        suggestedParams: await algod.getTransactionParams().do(),
    });
    
    appClient.placeOrder({ seed, cid, size, is_permanent: isPermanent, merchant })
}
```

## Deployment

L'applicazione Storage Price Estimator è configurata per il deployment su Vercel tramite il file `vercel.json` incluso nel progetto.

## Contribuire

Sentiti libero di contribuire a questo repository aggiungendo nuovi esempi o migliorando quelli esistenti. Ecco come puoi contribuire:

1. Fai un fork del repository
2. Crea un branch per le tue modifiche: `git checkout -b feature/nuova-feature`
3. Effettua le modifiche e testale
4. Invia una pull request con una descrizione dettagliata delle modifiche

## Licenza

Questo progetto è distribuito con licenza open source. Consulta il file LICENSE per maggiori dettagli. 