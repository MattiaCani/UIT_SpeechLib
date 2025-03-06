export class VoiceRecognizer {
    constructor(commands) {
        this.audioContext = new AudioContext();
        this.commands = commands;
        this.mediaStream = null;
        this.processor = null;
    }

    async startListening() {
        try {
            console.log("🎙️ Richiesta accesso al microfono...");
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log("✅ Microfono attivato");

            this.mediaStream.getTracks().forEach(track => console.log("🎙️ Stato microfono:", track.readyState));

            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            console.log("🔗 Collegamento sorgente audio...");

            await this.audioContext.audioWorklet.addModule("audio-processor.js");
            console.log("🛠️ AudioProcessor caricato");

            this.processor = new AudioWorkletNode(this.audioContext, "audio-processor");
            this.processor.onprocessorerror = (err) => {
                console.error("🚨 Errore nell'AudioProcessor:", err);
            };

            // Imposta la modalità su "recognize"
            this.processor.port.postMessage({ mode: "recognize" });
            console.log("🔄 Modalità impostata su 'recognize'");

            this.processor.port.onmessage = (event) => {
                console.log("📡 Dati ricevuti dal processore:", event.data); //si ferma qui, il processore non riceve i dati
                const { type, buffer } = event.data;
                if (type === "recognize") {
                    console.log("🎵 Audio ricevuto per riconoscimento");
                    const mfcc = this.extractMFCC(buffer);
                    console.log("🧐 MFCC estratti:", mfcc);

                    const match = this.findClosestMatch(mfcc);
                    console.log("🏆 Comando più vicino:", match);

                    if (match) {
                        console.log(`🔹 Comando riconosciuto: "${match}"`);
                        this.executeCommand(match);
                    }
                }
            };

            source.connect(this.processor);
            this.processor.connect(this.audioContext.destination);
            console.log("🎤 Riconoscimento vocale avviato");
        } catch (error) {
            console.error("❌ Errore durante l'avvio del riconoscimento vocale:", error);
        }
    }

    stopListening() {
        console.log("🛑 Arresto riconoscimento vocale...");
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }
        console.log("⏹️ Riconoscimento vocale fermato.");
    }

    extractMFCC(audioBuffer) {
        console.log("📊 Estrazione MFCC da buffer...");
        return audioBuffer.slice(0, 13);
    }

    findClosestMatch(mfcc) {
        let bestMatch = null;
        let minDistance = Infinity;

        for (const word in this.commands) {
            const distance = this.calculateDistance(mfcc, this.commands[word]);
            console.log(`📏 Distanza da "${word}":`, distance);
            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = word;
            }
        }

        console.log("🏆 Migliore corrispondenza:", bestMatch, "con distanza:", minDistance);
        return minDistance < 10 ? bestMatch : null;
    }

    calculateDistance(mfcc1, mfcc2) {
        return mfcc1.reduce((sum, val, i) => sum + Math.abs(val - (mfcc2[i] || 0)), 0);
    }

    executeCommand(command) {
        if (command === "avanti") {
            console.log("👌🏻 Comando 'avanti' riconosciuto");
            // document.getElementById("avanti-btn")?.click();
        } else if (command === "indietro") {
            console.log("👌🏻 Comando 'indietro' riconosciuto");
            document.getElementById("indietro-btn")?.click();
        } else {
            console.log("⚠ Comando non riconosciuto!");
        }
    }
}
