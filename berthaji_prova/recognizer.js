import {
    preEmphasis,
    frameSignal,
    applyWindow,
    fft,
    melFilterBank,
    logCompress,
    dct
} from './mfccUtils.js';

export class VoiceRecognizer {
    constructor(commands) {
        this.audioContext = new AudioContext();
        this.commands = commands;
        this.mediaStream = null;
        this.processor = null;
        this.currentMode = "recognize"; // Modalità attiva
        this.currentMFCC;
        this.label = "";
        this.match = null;
        this.similarita = [];
    }

    async startListening(label) {
        //pulisce la lista dei log nell'html
        document.getElementById("log").innerHTML = ""
        try {
            this.label = label;
            console.log("🎙️ Inizio registrazione per riconoscimento...");

            console.log("Commands di recognizer:")
            for (let key in this.commands) {
                if (this.commands.hasOwnProperty(key)) {  // Verifica se la proprietà appartiene all'oggetto
                    console.log(`${key}: ${this.commands[key]}`);
                }
            }

            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
                console.log("🎤 AudioContext avviato");
            }

            console.log("Riconoscimento sta accedendo al microfono");
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            console.log("✅ Microfono attivato per il riconoscimento");

            await this.audioContext.audioWorklet.addModule("audio-processor.js");
            console.log("Riconoscimento -> audio worklet ok");

            this.processor = new AudioWorkletNode(this.audioContext, "audio-processor");

            // Gain node per permettere una gestione più semplice del segnale
            const gainNode = this.audioContext.createGain();
            source.connect(gainNode);
            console.log("🔗 Sorgente audio collegata al GainNode");

            gainNode.connect(this.processor);
            console.log("🔗 GainNode collegato al processore");

            this.processor.connect(this.audioContext.destination);
            console.log("🔗 Processore collegato alla destinazione");

            this.currentMode = "recognize";
            this.processor.port.postMessage({ mode: this.currentMode, label });

            console.log("✅ Parla adesso...");

            // Reset del buffer
            this.collectedBuffers = [];

            // Listener sul processore per accumulare dati audio
            this.processor.port.onmessage = (event) => {
                if (this.currentMode === "recognize") {
                    const audioBuffer = event.data.buffer;
                    if (audioBuffer && audioBuffer.length > 0) {
                        this.collectedBuffers.push(...audioBuffer);
                    } else {
                        console.log("⚠️ Nessun dato audio ricevuto");
                    }
                }
            };

            return new Promise((resolve) => {
                this.stopListening = () => {
                    console.log("Riconoscimento fermato manualmente.");
                    // Se abbiamo raccolto dati, processali
                    if (this.collectedBuffers && this.collectedBuffers.length > 0) {
                        // Rimozione del silenzio, creazione del WAV, e impostazione dell'elemento audio se necessario
                        const processedBuffer = trimSilence(this.collectedBuffers, 0.01);
                        console.log(`🔍 Audio dopo rimozione silenzio: ${processedBuffer.length} campioni`);

                        const wavBlob = encodeWAV(processedBuffer, 44100);
                        const audioURL = URL.createObjectURL(wavBlob);
                        document.getElementById("audio-player").src = audioURL;
                        console.log(`Registrazione completata. WAV pronto su: ${audioURL}`);

                        // Estrai i MFCC
                        this.currentMFCC = this.extractMFCC(this.collectedBuffers);
                        //console.log(`Vettore MFCC audio per riconoscimento: ${this.currentMFCC}`)
                        console.log(`✅ Audio registrato con ${this.collectedBuffers.length} campioni`);

                        // Trova la migliore corrispondenza confrontando i MFCC
                        this.match = this.similaritaComandi(this.currentMFCC); //era this.findClosestMatch(this.currentMFCC)
                        console.log(`✅ Comando riconosciuto: "${this.match.nomeDelComando}"`);
                        this.executeCommand(this.match && this.match.nomeDelComando.toLowerCase());
                    } else {
                        console.log("⚠️ Nessun audio valido raccolto per il riconoscimento.");
                    }

                    // Spegni il media stream e disconnette il processore
                    if (this.mediaStream) {
                        this.mediaStream.getTracks().forEach(track => track.stop());
                        console.log("🎤 Microfono disattivato.");
                        this.mediaStream = null;
                    }
                    if (this.processor) {
                        this.processor.disconnect();
                        console.log("🎤 Processore audio disconnesso e rimosso.");
                        this.processor = null;
                    }
                    if (this.audioContext) {
                        this.audioContext.close().then(() => {
                            console.log("🎼 AudioContext chiuso.");
                            this.audioContext = null;
                        });
                    }

                    resolve();
                };
            });

        } catch (error) {
            console.error("❌ Errore durante il riconoscimento:", error);
        }
    }

    similaritaComandi(mfcc) {
        // Assicurati che this.similarita sia inizializzato come array vuoto ogni volta
        this.similarita = [];

        Object.keys(this.commands).forEach(key => {
            // Verifica che mfcc e this.commands[key] siano array validi prima di procedere
            if (!Array.isArray(mfcc) || !Array.isArray(this.commands[key]) || mfcc.length === 0 || this.commands[key].length === 0) {
                console.warn(`Vettore non valido per il comando ${key}`);
                return; // Salta questo comando
            }
            this.similarita.push({
                nomeDelComando: key,
                similaritaConRec: this.similaritaDTW(mfcc, this.commands[key])
            });
        });

        if (this.similarita.length === 0) {
            console.error("Nessun comando valido trovato per il confronto.");
            return null;
        }

        // ora che ho l'oggetto con le similarità tra i comandi registrati e l'mfcc appena registrato
        // cerco quello con similarità più alta e lo restituisco
        const bestMatchFound = this.similarita.reduce((prev, curr) => {
            return (curr.similaritaConRec > prev.similaritaConRec) ? curr : prev;
        });

        console.log(`Similarita tra rec e comandi registrati:`);
        console.log(`Nome: ${bestMatchFound.nomeDelComando}, Similarita: ${bestMatchFound.similaritaConRec}`);

        return bestMatchFound;
    }

    dtwDistance(seq1, seq2) {
        const n = seq1.length;
        const m = seq2.length;

        if (n === 0 || m === 0) {
            console.warn("Una delle sequenze è vuota. Restituisco Infinity.");
            return Infinity;
        }

        // Inizializza la matrice DTW con valori "infinito"
        const dtw = Array.from({ length: n + 1 }, () => Array(m + 1).fill(Infinity));
        dtw[0][0] = 0;

        for (let i = 1; i <= n; i++) {
            for (let j = 1; j <= m; j++) {
                const vector1 = seq1[i - 1];
                const vector2 = seq2[j - 1];

                // Assicurati che entrambi siano array (vettori) e abbiano la stessa dimensione
                if (!Array.isArray(vector1) || !Array.isArray(vector2) || vector1.length !== vector2.length) {
                    console.error(`Formato vettoriale errato per i frame ${i - 1} e ${j - 1}`);
                    return Infinity;
                }

                // Calcola la distanza euclidea tra i due vettori
                const cost = Math.sqrt(vector1.reduce((acc, val, idx) => {
                    const diff = val - vector2[idx];
                    return acc + diff * diff;
                }, 0));

                dtw[i][j] = cost + Math.min(
                    dtw[i - 1][j],      // Inserimento
                    dtw[i][j - 1],      // Cancellazione
                    dtw[i - 1][j - 1]   // Match
                );
            }
        }

        return dtw[n][m];
    }

    similaritaDTW(vettore1, vettore2) {
        const distanza = this.dtwDistance(vettore1, vettore2);
        const similarita = 1 / (1 + distanza);
        console.log(`similarita calcolata: ${similarita}`);
        console.log(`Distanza: ${distanza}`);
        return similarita;
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

    findClosestMatch(mfcc) {
        let bestMatch = null;
        let minDistance = Infinity;

        for (const word in this.commands) {
            const distance = this.calculateDistance(mfcc, this.commands[word]);
            console.log(`📏 Distanza da "${word}": ${distance}`);

            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = word;
            }
        }

        console.log(`Migliore corrispondenza: ${bestMatch} con distanza: ${minDistance}`);
        return minDistance < 10 ? bestMatch : null;
    }

    calculateDistance(mfcc1, mfcc2) {
        //console.log(`Grandezze vettori: MFCC1 = ${mfcc1.length} e MFCC = ${mfcc2.length}`)
        //mfcc1 = mfcc1.slice(0, 100);
        //mfcc2 = mfcc2.slice(0, 100);
        return mfcc1.reduce((sum, val, i) => sum + Math.abs(val - (mfcc2[i] || 0)), 0);
    }

    executeCommand(command) {
        if (command === "avanti") {
            console.log("👌🏻 Comando 'avanti' riconosciuto");
            document.getElementById("avanti-btn")?.click();
        } else if (command === "indietro") {
            console.log("👌🏻 Comando 'indietro' riconosciuto");
            document.getElementById("indietro-btn")?.click();
        } else {
            console.log("⚠ Comando non riconosciuto!");
        }
    }

    updateCommands(commands){
        this.commands = commands;
        const chiavi = Object.keys(this.commands);
        console.log(`🔄 Comandi aggiornati nel riconoscitore: ${chiavi}`);
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
