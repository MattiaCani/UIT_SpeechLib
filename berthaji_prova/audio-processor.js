class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.mode = "record";  // Modalità di default
        this.sampleRate = 44100; // Frequenza di campionamento

        // Ascolta i messaggi dal thread principale per cambiare modalità
        this.port.onmessage = (event) => {
            if (event.data.mode) {
                this.mode = event.data.mode;
                console.log(`🎤 Modalità cambiata a: ${this.mode}`);
            }
        };
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];

        if (input && input.length > 0) {
            const buffer = input[0];

            // Controlla se il buffer contiene dati significativi (audio sopra una soglia)
            const sum = buffer.reduce((acc, val) => acc + Math.abs(val), 0);
            const average = sum / buffer.length;

            if (average > 0.0001) {  // Soglia minima per considerare audio valido
                console.log("🔊 Dati audio significativi ricevuti:", buffer.slice(0, 10));

                // Converti il buffer in un formato serializzabile
                const serializedBuffer = Array.from(buffer);

                // Invia solo se contiene dati significativi
                this.port.postMessage({ type: this.mode, buffer: serializedBuffer });
            } else {
                console.log("⚠️ Audio troppo basso, ignorato.");
            }
        }

        return true;  // Continua l'elaborazione
    }
}

// Registra l'AudioProcessor
registerProcessor("audio-processor", AudioProcessor);