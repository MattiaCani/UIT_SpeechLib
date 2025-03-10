import {
    preEmphasis,
    frameSignal,
    applyWindow,
    fft,
    melFilterBank,
    logCompress,
    dct
} from './mfccUtils.js';


export class CommandRecorder {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.commands = {};
        this.mediaStream = null;
        this.processor = null;
        this.collectedBuffers = [];  // Buffer per accumulare l'audio
        this.currentMode = "record";
    }

    async recordCommand(label) {
        console.log("🎤 Inizio acquisizione stream audio");

        // Se l'audioContext è null (perché è stato chiuso in precedenza), ricrealo
        if (!this.audioContext || this.audioContext.state === 'closed') {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log("🎤 AudioContext ricreato");
        }

        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
            console.log("🎤 AudioContext avviato");
        }

        try {
            console.log("🎤 Accesso al microfono...");
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = this.audioContext.createMediaStreamSource(this.mediaStream);

            console.log("🎤 Microfono attivato");

            await this.audioContext.audioWorklet.addModule("audio-processor.js");
            console.log("🎤 Audio Worklet caricato correttamente");

            this.processor = new AudioWorkletNode(this.audioContext, "audio-processor");

            // Crea un GainNode per monitorare il flusso audio
            const gainNode = this.audioContext.createGain();

            // Collega la sorgente audio al GainNode
            source.connect(gainNode);
            console.log("🔗 Sorgente audio collegata al GainNode");

            // Collega il GainNode al processore
            gainNode.connect(this.processor);
            console.log("🔗 GainNode collegato al processore");

            // Collega il processore alla destinazione (output audio)
            this.processor.connect(this.audioContext.destination);
            console.log("🔗 Processore collegato alla destinazione");

            // Imposta la modalità in base al contesto (qui "record")
            this.currentMode = "record";
            this.processor.port.postMessage({ mode: this.currentMode, label }); // messaggio inutile???????
            console.log(`🎤 Parla ora per registrare il comando: "${label}"`);

            this.collectedBuffers = []; // Pulisce i dati precedenti

            // Imposta un listener unico per il processore
            this.processor.port.onmessage = (event) => {
                // Verifica quale modalità è attiva e gestisci il messaggio di conseguenza
                if (this.currentMode === "record") {
                    const audioBuffer = event.data.buffer;
                    if (audioBuffer && audioBuffer.length > 0) {
                        this.collectedBuffers.push(...audioBuffer); // Accumula i dati audio
                    } else {
                        console.log("⚠️ Nessun dato audio ricevuto");
                    }
                } else if (this.currentMode === "recognize") {
                    // Se in modalità "recognize", invia i dati al riconoscitore
                    // (Puoi avere una logica simile qui per il riconoscimento)
                    console.log("Ricevuti dati per il riconoscimento:", event.data);

                }
            };

            // Restituisci una promise per gestire la fine della registrazione
            return new Promise((resolve) => {
                this.stopRecording = () => {
                    console.log("⏹️ Registrazione fermata manualmente.");

                    if (this.collectedBuffers.length > 0) {
                        const processedBuffer = trimSilence(this.collectedBuffers, 0.01);
                        console.log(`🔍 Audio dopo rimozione silenzio: ${processedBuffer.length} campioni`);

                        const wavBlob = encodeWAV(processedBuffer, 44100);
                        const audioURL = URL.createObjectURL(wavBlob);
                        document.getElementById("audio-player").src = audioURL;
                        console.log(`Registrazione completata. WAV pronto su: ${audioURL}`);
                    } else {
                        console.log("⚠️ Nessun audio registrato.");
                    }

                    if (this.collectedBuffers.length > 0) {
                        this.commands[label] = this.extractMFCC(this.collectedBuffers);
                        console.log(`✅ Comando "${label}" registrato con ${this.collectedBuffers.length} campioni`);
                    } else {
                        console.log("⚠️ Nessun audio valido dopo il filtraggio.");
                    }

                    // Spegni il microfono e disconnetti i nodi audio
                    if (this.mediaStream) {
                        this.mediaStream.getTracks().forEach(track => track.stop());
                        console.log("🎤 Microfono disattivato.");
                        this.mediaStream = null;
                    }

                    if (this.processor) {
                        // Non cancelliamo il listener; lo lasciamo attivo per eventuali futuri passaggi
                        this.processor.disconnect();
                        this.processor = null;
                        console.log("🎤 Processore audio disconnesso e rimosso.");
                    }

                    if (this.audioContext) {
                        this.audioContext.close().then(() => {
                            console.log("🎼 AudioContext chiuso.");
                            this.audioContext = null;
                        });
                    }

                    console.log("Contenuto di commands:")
                    for (let key in this.commands) {
                        if (this.commands.hasOwnProperty(key)) {  // Verifica se la proprietà appartiene all'oggetto
                            console.log(`${key}: ${this.commands[key]}`);
                        }
                    }

                    resolve();
                };
            });
        } catch (error) {
            console.error("⚠️ Errore durante la registrazione del comando:", error);
        }
    }

    extractMFCC(audioBuffer) {
        console.log("🔊 Estrazione MFCC");

        // Verifica se il buffer è valido
        if (!audioBuffer || audioBuffer.length === 0) {
            console.log("⚠️ Buffer audio vuoto, non è possibile estrarre MFCC.");
            return [];
        }

        // Ottieni il sampleRate dal contesto audio
        const sampleRate = this.audioContext.sampleRate;
        console.log(`🎶 Sample rate: ${sampleRate}`);

        // Stampa la lunghezza del buffer e un'anteprima dei primi 20 valori
        console.log(`📏 Lunghezza buffer audio prima di estrarre MFCC: ${audioBuffer.length}`);
        console.log(`🔍 Anteprima dei primi 20 campioni del buffer:", ${audioBuffer.slice(0, 20)}`);

        // 1. Pre-emphasis (filtro)
        const emphasizedSignal = preEmphasis(audioBuffer);
        console.log(`🔍 Segnale dopo pre-emphasis: ${emphasizedSignal.slice(0, 20)}`);

        // 2. Frame del segnale
        const frameSize = 1024;
        const hopSize = 512;
        const frames = frameSignal(emphasizedSignal, frameSize, hopSize);
        console.log(`🔍 Numero di frame ${frames.length}`);

        // 3. Applicare la finestra di Hamming ad ogni frame
        const windowedFrames = frames.map(frame => applyWindow(frame));

        // 4. Calcolare la FFT per ogni frame e applicare il filtro Mel
        const melFilters = melFilterBank(26, frameSize, sampleRate);  // 26 filtri Mel
        const melSpectrogram = windowedFrames.map(frame => {
            const fftResult = fft(frame);
            const magnitudeSpectrum = fftResult.slice(0, frameSize / 2).map(x => Math.sqrt(x.real * x.real + x.imag * x.imag));
            const melSpectrum = melFilters.map(filter => filter.map(f => magnitudeSpectrum[f] || 0).reduce((acc, curr) => acc + curr, 0));
            return logCompress(melSpectrum); // Compress the mel spectrum logarithmically
        });

        // 5. Estrazione dei MFCC con DCT (Discrete Cosine Transform)
        const mfccs = melSpectrogram.map(mel => dct(mel).slice(0, 13)); // Estrarre i primi 13 coefficienti

        // Stampa i risultati per debug
        console.log(`🔍 MFCC estratti: ${mfccs}`);
        return mfccs;
    }

    getCommands() {
        return this.commands;
    }
}

// Funzione per rimuovere il silenzio iniziale e finale
function trimSilence(buffer, threshold) {
    let start = 0;
    let end = buffer.length - 1;

    // Trova il primo punto con suono significativo
    while (start < buffer.length && Math.abs(buffer[start]) < threshold) {
        start++;
    }

    // Trova l'ultimo punto con suono significativo
    while (end > 0 && Math.abs(buffer[end]) < threshold) {
        end--;
    }

    const trimmedBuffer = start < end ? buffer.slice(start, end + 1) : [];
    console.log(`🔪 Buffer audio dopo rimozione silenzio: ${trimmedBuffer.length} campioni`);
    return trimmedBuffer;
}

/* Funzione per convertire i buffer registrati (l'array this.collectedBuffers)
in un Blob di tipo WAV */
function encodeWAV(buffers, sampleRate) {
    // Se buffers è un array di numeri, lo converto direttamente in un Float32Array.
    // Nel tuo caso, this.collectedBuffers è stato riempito con dati numerici tramite spread operator.
    const interleaved = new Float32Array(buffers);

    // Calcola la dimensione necessaria per il file WAV: 44 byte di header + 2 byte per campione PCM a 16 bit
    const bufferLength = 44 + interleaved.length * 2;
    const wavBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(wavBuffer);

    // Scrivi l'header WAV
    writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + interleaved.length * 2, true);
    writeString(view, 8, "WAVE");
    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true); // Dimensione del formato chunk
    view.setUint16(20, 1, true);  // Audio format = PCM
    view.setUint16(22, 1, true);  // Canali = 1 (mono)
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byteRate = sampleRate * canali * bits/8
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    writeString(view, 36, "data");
    view.setUint32(40, interleaved.length * 2, true);

    // Scrive i dati PCM: converte Float32 in Int16
    let index = 44;
    for (let i = 0; i < interleaved.length; i++, index += 2) {
        // Constrain il valore tra -1 e 1
        let sample = Math.max(-1, Math.min(1, interleaved[i]));
        // Converte in Int16
        view.setInt16(index, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    }

    return new Blob([view], { type: "audio/wav" });
}

/* Funzione di supporto per scrivere le stringhe nell'header WAV */
function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}