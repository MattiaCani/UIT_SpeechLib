import { CommandRecorder } from "./recorder.js";
import { VoiceRecognizer } from "./recognizer.js";

// Inizializza il registratore
const recorder = new CommandRecorder();

// Crea il riconoscitore, ma non avviare ancora il riconoscimento
const recognizer = new VoiceRecognizer(recorder.getCommands());
console.log("main.js caricato correttamente"); // Mostra il messaggio all'avvio del file

if ('AudioContext' in window) {
    console.log("AudioContext è supportato"); //check sul browser per vedere se funge
} else {
    console.log("AudioContext non è supportato nel tuo browser");
}

// Variabile per tracciare il comando corrente da registrare
let currentCommand = "avanti";  // Iniziamo con il comando "avanti"

// Imposta l'event listener per il pulsante di registrazione
document.getElementById('start-btn').addEventListener('click', async () => {
    // Modifica il comportamento del pulsante in base al comando attuale
    const button = document.getElementById('start-btn');

    console.log(`🎤 Inizio registrazione comando "${currentCommand}"`);

    // Registra il comando attuale
    await recorder.recordCommand(currentCommand);
    console.log(`✅ Comando "${currentCommand}" registrato`);

    // passa i comandi registrati al recognizer
    recognizer.updateCommands(recorder.getCommands());

    // Dopo che un comando è stato registrato, alterniamo il comando successivo
    currentCommand = currentCommand === "avanti" ? "indietro" : "avanti";  // Alterna tra "avanti" e "indietro"

    // Cambia il testo del pulsante per il prossimo comando
    document.getElementById('start-btn').textContent = `Registra comando "${currentCommand}"`;
});

// Ferma la registrazione
document.getElementById('stop-btn').addEventListener('click', () => {
    console.log("⏹️ Fine registrazione comando");
    recorder.stopRecording();
});

// Inizia il riconoscimento vocale
document.getElementById('start-recognition-btn').addEventListener('click', async () => {
    console.log('🎤 Inizio riconoscimento vocale');
    await recognizer.startListening(currentCommand);
});

// Ferma il riconoscimento vocale
document.getElementById('stop-recognition-btn').addEventListener('click', () => {
    console.log("⏹️ Fine riconoscimento vocale");
    recognizer.stopListening();
});