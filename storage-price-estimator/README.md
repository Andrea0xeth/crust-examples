# Storage Price Estimator

Applicazione per stimare il costo di archiviazione dei file sulla blockchain Algorand usando il protocollo Crust.

## Demo Online

Puoi provare l'applicazione online qui: [https://storage-price-estimator.vercel.app/](https://storage-price-estimator.vercel.app/)

## Funzionalità

- Upload di file tramite drag & drop o file dialog
- Visualizzazione del costo di archiviazione in tempo reale
- Opzioni per archiviazione temporanea (1x) o permanente (5x)
- Visualizzazione prezzi in multiple valute: ALGO, CRUST, USD, EUR
- Impostazioni avanzate per personalizzare i parametri di calcolo
- Tooltips informativi per guidare l'utente

## Requisiti

- Node.js (v14 o superiore)
- npm (v6 o superiore)

## Guida Completa all'Installazione

### Passo 1: Setup Iniziale

1. **Clona il repository** (se non l'hai già fatto):
   ```bash
   git clone https://github.com/Andrea0xeth/crust-examples.git
   ```

2. **Naviga nella directory del progetto**:
   ```bash
   cd crust-examples/storage-price-estimator
   ```

3. **Installa le dipendenze**:
   ```bash
   npm install
   ```
   
   > **Nota**: Se incontri errori durante l'installazione, prova con `npm install --legacy-peer-deps`

### Passo 2: Avvio dell'Applicazione

Puoi avviare l'applicazione in diversi modi:

#### Avvio Standard (Produzione)

```bash
npm start
```

Questo avvia il server Express che serve sia il frontend che le API su http://localhost:3000

#### Avvio in Modalità Sviluppo (con Hot Reload)

```bash
npm run dev
```

Questa modalità utilizza `nodemon` per riavviare automaticamente il server quando vengono apportate modifiche ai file.

#### Specificare una Porta Diversa

Se la porta 3000 è già in uso, puoi specificare una porta diversa:

```bash
PORT=8080 npm start
```

### Passo 3: Utilizzo dell'Applicazione

1. Apri il browser all'indirizzo [http://localhost:3000](http://localhost:3000) (o la porta che hai specificato)
2. Carica un file trascinandolo nell'area designata o utilizzando il pulsante "Seleziona File"
3. Attendi il calcolo del prezzo (avviene automaticamente)
4. Visualizza i risultati nelle schede "Temporaneo" e "Permanente"
5. Per opzioni avanzate, clicca su "Opzioni Avanzate" per personalizzare i parametri di calcolo

## Struttura del Progetto

```
storage-price-estimator/
├── public/              # File statici
│   ├── css/             # Fogli di stile
│   └── js/              # Script client-side
├── views/               # Template EJS
│   └── index.ejs        # Pagina principale
├── server.js            # Server Express e logica backend
├── package.json         # Dipendenze e script npm
└── vercel.json          # Configurazione per deployment su Vercel
```

## Come Funziona

L'applicazione è composta da:

- **Frontend**: Un'interfaccia utente costruita con HTML, CSS, JavaScript e Bootstrap 5, servita tramite template EJS
- **Backend**: Un server Express.js che gestisce:
  - Caricamento file temporaneo
  - Calcolo dei prezzi di archiviazione tramite API Algorand
  - Recupero dei tassi di cambio per le diverse valute

Il flusso di esecuzione è il seguente:

1. L'utente carica un file
2. Il server calcola la dimensione del file
3. L'API simula il costo di archiviazione sulla blockchain Algorand
4. Il risultato viene mostrato all'utente con equivalenti in varie valute

## Risoluzione dei Problemi

### Problemi Comuni

- **Errore "Cannot find module"**: 
  ```
  Soluzione: Esegui `npm install` nella directory corretta (storage-price-estimator)
  ```

- **Errore "EADDRINUSE" (Porta in uso)**:
  ```
  Soluzione: Cambia la porta utilizzando PORT=8080 npm start
  ```

- **Il file non viene caricato correttamente**:
  ```
  Soluzione: Assicurati che il file non superi il limite di 50MB
  ```

- **Errore "Failed to fetch token prices"**:
  ```
  Soluzione: Verifica la tua connessione internet o riprova più tardi
  ```

- **Problemi di visualizzazione**:
  ```
  Soluzione: Cancella la cache del browser o prova con un browser diverso
  ```

### Debug Avanzato

Per diagnosticare problemi più complessi, puoi eseguire l'applicazione con log dettagliati:

```bash
DEBUG=app:* npm start
```

## Sviluppo e Contributi

### Ambiente di Sviluppo

1. Avvia l'applicazione in modalità sviluppo:
   ```bash
   npm run dev
   ```

2. Le modifiche ai file JavaScript, CSS ed EJS attiveranno un riavvio automatico del server

### Test

Esegui i test:

```bash
npm test
```

## Deployment

### Deployment Locale

Esegui in produzione con PM2 (se installato):

```bash
pm2 start server.js --name "storage-estimator"
```

### Deployment su Vercel

L'applicazione è configurata per essere deployata su Vercel. Basta collegare il repository al tuo account Vercel.

## Note Tecniche

- L'applicazione utilizza Algorand TestNet per i calcoli dei prezzi
- I prezzi in USD ed EUR sono ottenuti dalle API di CoinGecko
- Per l'archiviazione permanente, il prezzo è moltiplicato per 5
- I parametri di prezzo possono essere personalizzati nelle opzioni avanzate 