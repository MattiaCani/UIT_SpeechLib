# Progetto di User Interface Technologies
## Gestione delle Dipendenze

Il repository non include la cartella `node_modules` per mantenere il repository leggero e facilmente gestibile. Tutte le dipendenze sono gestite tramite il file `package.json` e il file di lock (`package-lock.json` o `yarn.lock`). La cartella 'speech' contiene i file del modulo Web Speech API che è presente nel codice sorgente di Chromium e può essere recuperato dalla repo di Chromium (da vedere se va bene quello che ho trovato): https://github.com/chromium/chromium/tree/main 

## Installazione delle Dipendenze

Dopo aver clonato il repository su un altro sistema, assicurati di avere Node.js e NPM installati, quindi esegui:

```bash
npm install
```
Questo comando installerà tutte le dipendenze elencate in package.json utilizzando le versioni specificate in package-lock.json.

Dopo aver fatto qualsiasi modifica al file JavaScript (attenzione, non quello dentro il .html) runnare il seguente comando su terminale:

```bash
npx webpack
```

## Berthaji_prova - Descrizione e installazione delle dipendenze

La cartella include una prova di sistema di speech recognition che non utilizza API o librerie non standard. Contiene un file `main.js` che si occupa di fare da ponte tra il file `index.html` e tutte le altre parti utili, chiamando le funzioni necessarie all'interazione coi bottoni. Il file `recorder.js` serve a registrare i comandi che poi potranno essere utilizzati nell'interfaccia, il file `recognizer.js` riconosce i comandi registrati ed esegue l'azione collegata. Entrambi i file si appoggiano a `audio-processor.js` per elaborare l'audio. I comandi salvati non vengono salvati perennemente, valgono solo per la run corrente.
Per l'installazione di http-server:

```bash
npm install -g http-server
```

Per l'avvio del server basta eseguire il comando:

```bash
http-server
```

Questo comando porta a localhost, a cui basta aggiungere il percorso `berthaji_prova/index.html` per aprire la prova di interfaccia.


