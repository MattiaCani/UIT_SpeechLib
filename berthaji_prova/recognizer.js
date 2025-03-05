export class VoiceRecognizer {
    constructor(commands) {
        this.audioContext = new AudioContext();
        this.commands = commands;
        this.mediaStream = null;
        this.processor = null;
    }

    async startListening() {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);

        // Carica l'Audio Worklet
        await this.audioContext.audioWorklet.addModule("audio-processor.js");

        // Crea un AudioWorkletNode e imposta la modalità su "recognize"
        this.processor = new AudioWorkletNode(this.audioContext, "audio-processor");
        this.processor.port.postMessage({ mode: "recognize" });

        // Ascolta i messaggi dal AudioProcessor
        this.processor.port.onmessage = (event) => {
            const { type, buffer } = event.data;

            if (type === "recognize") {
                // Estrai MFCC dal buffer audio ricevuto
                const mfcc = this.extractMFCC(buffer);

                // Trova il comando più simile
                const match = this.findClosestMatch(mfcc);

                if (match) {
                    console.log(`🔹 Comando riconosciuto: "${match}"`);
                    this.executeCommand(match);
                }
            }
        };

        // Collega i nodi audio
        source.connect(this.processor);
        this.processor.connect(this.audioContext.destination);

        console.log("🎤 Riconoscimento vocale avviato");
    }

    stopListening() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop()); // Ferma il microfono
        }
        if (this.processor) {
            this.processor.disconnect(); // Disconnetti il processore
        }
        console.log("⏹️ Riconoscimento vocale fermato.");
    }

    extractMFCC(audioBuffer) {
        return audioBuffer.slice(0, 13);
    }

    findClosestMatch(mfcc) {
        let bestMatch = null;
        let minDistance = Infinity;

        for (const word in this.commands) {
            const distance = this.calculateDistance(mfcc, this.commands[word]);
            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = word;
            }
        }

        return minDistance < 10 ? bestMatch : null;  // Threshold per accettare un comando
    }

    calculateDistance(mfcc1, mfcc2) {
        return mfcc1.reduce((sum, val, i) => sum + Math.abs(val - (mfcc2[i] || 0)), 0);
    }

    executeCommand(command) {
        if (command === "avanti") {
            document.getElementById("avanti-btn").click();
        } else if (command === "indietro") {
            document.getElementById("indietro-btn").click();
        } else {
            console.log("⚠ Comando non riconosciuto!");
        }
    }
}