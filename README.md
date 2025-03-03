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
