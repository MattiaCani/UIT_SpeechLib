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
    }

    async recordCommand(label) { // Registra qualcosa
        console.log("🎤 Inizio acquisizione stream audio");

        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
            console.log("🎤 AudioContext avviato");
        }

        try {
            console.log("🎤 Accesso al microfono...");
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true }); // Accede al microfono
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

            // Collega il GainNode al preprocessore
            gainNode.connect(this.processor);
            console.log("🔗 GainNode collegato al processore");

            // Collega il preprocessore alla destinazione (output audio)
            this.processor.connect(this.audioContext.destination);
            console.log("🔗 Processore collegato alla destinazione");

            // Invia il messaggio per impostare la modalità di registrazione
            this.processor.port.postMessage({ mode: "record", label });

            console.log(`🎤 Parla ora per registrare il comando: "${label}"`); // Registra quello che dici

            this.collectedBuffers = []; // Pulisce i dati precedenti

            return new Promise((resolve) => {
                this.processor.port.onmessage = (event) => {
                    const audioBuffer = event.data.buffer;

                    if (audioBuffer && audioBuffer.length > 0) {
                        //console.log(`🎵 Dati audio ricevuti: ${audioBuffer.length} campioni`);
                        this.collectedBuffers.push(...audioBuffer); // Accumula i dati audio
                    } else {
                        console.log("⚠️ Nessun dato audio ricevuto");
                    }
                };

                // Quando la registrazione viene fermata, processa l'audio
                this.stopRecording = () => {
                    console.log("⏹️ Registrazione fermata manualmente.");

                    if (this.collectedBuffers.length > 0) {
                        // Filtra il silenzio iniziale e finale nell'audio catturato
                        const processedBuffer = trimSilence(this.collectedBuffers, 0.01);
                        console.log(`🔍 Audio dopo rimozione silenzio: ${processedBuffer.length} campioni`);

                        if (processedBuffer.length > 0) {
                            this.commands[label] = this.extractMFCC(processedBuffer); // Estrai 13 caratteristiche (APPROSSIMAZIONE)
                            console.log(`✅ Comando "${label}" registrato con ${processedBuffer.length} campioni`);
                        } else {
                            console.log("⚠️ Nessun audio valido dopo il filtraggio.");
                        }
                    } else {
                        console.log("⚠️ Nessun audio registrato.");
                    }

                    // Spegni il microfono rilasciando lo stream
                    if (this.mediaStream) {
                        this.mediaStream.getTracks().forEach(track => track.stop());
                        console.log("🎤 Microfono disattivato.");
                        this.mediaStream = null;
                        this.processor.disconnect();
                        console.log("🎤 Processore audio disconnesso.");
                        this.processor.disconnect();
                        gainNode.disconnect();
                        source.disconnect();  // Disconnetti anche la sorgente
                        this.processor.port.onmessage = null; // Rimuove l'event listener
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