export class CommandRecorder {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.commands = {};
        this.mediaStream = null;
        this.processor = null;
        this.collectedBuffers = [];  // Buffer per accumulare l'audio
    }

    async recordCommand(label) {
        console.log("🎤 Inizio acquisizione stream audio");

        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
            console.log("🎤 AudioContext avviato");
        }

        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = this.audioContext.createMediaStreamSource(this.mediaStream);

            console.log("🎤 Microfono attivato");

            await this.audioContext.audioWorklet.addModule("audio-processor.js");
            console.log("🎤 Audio Worklet caricato correttamente");

            this.processor = new AudioWorkletNode(this.audioContext, "audio-processor");

            this.processor.port.postMessage({ mode: "record", label });

            source.connect(this.processor);
            this.processor.connect(this.audioContext.destination);
            console.log(`🎤 Parla ora per registrare il comando: "${label}"`);

            this.collectedBuffers = []; // Pulisce i dati precedenti

            return new Promise((resolve) => {
                this.processor.port.onmessage = (event) => {
                    const audioBuffer = event.data.buffer;

                    if (audioBuffer && audioBuffer.length > 0) {
                        this.collectedBuffers.push(...audioBuffer); // Accumula i dati audio
                    }
                };

                // Quando la registrazione viene fermata, processa l'audio
                this.stopRecording = () => {
                    console.log("⏹️ Registrazione fermata manualmente.");

                    if (this.collectedBuffers.length > 0) {
                        // Filtra il silenzio iniziale e finale
                        const processedBuffer = trimSilence(this.collectedBuffers, 0.01);

                        if (processedBuffer.length > 0) {
                            this.commands[label] = this.extractMFCC(processedBuffer);
                            console.log(`✅ Comando "${label}" registrato con ${processedBuffer.length} campioni`);
                        } else {
                            console.log("⚠️ Nessun audio valido dopo il filtraggio.");
                        }
                    } else {
                        console.log("⚠️ Nessun audio registrato.");
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
        return audioBuffer.slice(0, 13);  // Estrazione dei primi 13 coefficienti
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

    return start < end ? buffer.slice(start, end + 1) : [];
}