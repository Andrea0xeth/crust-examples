# Storage Price Estimator

Applicazione per stimare il costo di archiviazione dei file sulla blockchain Algorand usando il protocollo Crust.

## Demo Online

Puoi provare l'applicazione online qui: [https://storage-price-estimator.vercel.app/](https://storage-price-estimator.vercel.app/)

## Features

- Upload di file e stima immediata del costo di archiviazione
- Opzione per archiviazione temporanea o permanente
- Visualizzazione del costo in microAlgos e Algos
- Interfaccia utente intuitiva

## Requisiti

- Node.js (v14 o superiore)
- npm (v6 o superiore)

## Installazione

1. Clona questo repository
2. Naviga nella directory del progetto
3. Installa le dipendenze:

```bash
npm install
```

## Utilizzo

1. Avvia l'applicazione:

```bash
npm start
```

2. Apri il browser all'indirizzo [http://localhost:3000](http://localhost:3000)
3. Carica un file e scegli le opzioni di archiviazione
4. Visualizza il costo di archiviazione stimato

## Come Funziona

L'applicazione utilizza i seguenti componenti:

- **Express.js**: Framework web server
- **EJS**: Template engine per il frontend
- **Algorand SDK**: Per interagire con la blockchain Algorand
- **AlgoKit Utils**: Funzioni di utilità per lo sviluppo Algorand

Il calcolo del prezzo viene effettuato utilizzando la funzione `getPrice` dal protocollo di archiviazione Crust, che simula il costo senza effettivamente caricare il file o effettuare transazioni blockchain.

## Sviluppo

Per eseguire l'applicazione in modalità sviluppo con riavvio automatico:

```bash
npm run dev
```

## Note

- Questo è solo uno strumento di stima dei prezzi. Non carica effettivamente i file sulla blockchain.
- L'applicazione utilizza Algorand TestNet per i calcoli dei prezzi.
- I prezzi effettivi possono variare in base alle condizioni attuali della rete e ai parametri di prezzo. 