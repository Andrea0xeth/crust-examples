# Crust Examples

Questa repository contiene esempi di integrazione con il protocollo di archiviazione Crust su blockchain Algorand.

## Demo Online

Puoi provare l'applicazione Storage Price Estimator online qui: [https://storage-price-estimator.vercel.app/](https://storage-price-estimator.vercel.app/)

## Struttura della Repository

- **typescript/**: Esempi di implementazione in TypeScript
  - `src/StorageOrderClient.ts`: Client per interagire con il contratto di archiviazione
  - `src/index.ts`: Esempio di utilizzo delle API per caricare file e ordinare archiviazione
- **application.json**: Specifiche dell'applicazione e metodi ABI disponibili
- **storage-price-estimator/**: Applicazione web per stimare i costi di archiviazione

## Esempi Disponibili

### Client TypeScript

La directory `typescript/` contiene un client TypeScript completo per interagire con il contratto di archiviazione su Algorand. Include funzionalità come:

- Caricare file su IPFS
- Ottenere il prezzo di archiviazione di un file
- Effettuare ordini di archiviazione

Per eseguire l'esempio TypeScript:

```bash
cd typescript
npm install
# Modifica il file index.ts se necessario
npm start
```

### Stimatore di Prezzi di Archiviazione

Nella directory `storage-price-estimator/` è disponibile un'applicazione web che permette di stimare il costo di archiviazione dei file sulla blockchain Algorand.

#### Caratteristiche

- Upload di file e stima immediata del costo di archiviazione
- Opzione per archiviazione temporanea o permanente
- Visualizzazione del costo in microAlgos e Algos
- Interfaccia utente intuitiva

#### Come Eseguire l'Applicazione Stimatore di Prezzi

Per utilizzare questa applicazione:

1. Naviga nella directory dell'applicazione:
   ```bash
   cd storage-price-estimator
   ```

2. Installa le dipendenze:
   ```bash
   npm install
   ```

3. Avvia l'applicazione:
   ```bash
   npm start
   ```

4. Apri il browser all'indirizzo [http://localhost:3000](http://localhost:3000)

5. Per eseguire l'applicazione in modalità sviluppo con riavvio automatico:
   ```bash
   npm run dev
   ```

#### Nota Importante

Assicurati di eseguire tutti i comandi npm dalla directory corretta. Se riscontri errori come:
```
Could not read package.json: Error: ENOENT: no such file or directory
```
Significa che devi navigare nella directory specifica dell'esempio che vuoi eseguire (ad esempio `cd storage-price-estimator`) prima di eseguire i comandi npm.

## Funzioni di Base

### Ottenere il Prezzo di Archiviazione

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

### Effettuare un Ordine di Archiviazione

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

## Contribuire

Sentiti libero di contribuire a questo repository aggiungendo nuovi esempi o migliorando quelli esistenti. 

sizeInKB = ceiling(size / 1024)
byteCost = sizeInKB * bytePrice
totalPrice = basePrice + byteCost

if (isPermanent) {
    totalPrice *= permanentMultiplier
} 