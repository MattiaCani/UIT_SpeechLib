class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.mode = "record";  // Modalità di default
        this.sampleRate = 44100; // Frequenza di campionamento

        this.port.onmessage = (event) => {
            if (event.data.mode) {
                this.mode = event.data.mode;
                console.log(`🎤 Modalità cambiata a: ${this.mode}`);
            }
        };
    }

    process(inputs, outputs, parameters) {
        console.log("process avviato")
        const input = inputs[0];

        if (input && input.length > 0) {
            const buffer = input[0];

            // Controlla se il buffer contiene dati significativi
            const sum = buffer.reduce((acc, val) => acc + Math.abs(val), 0);
            const average = sum / buffer.length;

            if (average > 0.0001) {  // Soglia minima per considerare audio valido
                const serializedBuffer = Array.from(buffer);

                if (this.mode === "record") {
                    console.log("🎙️ Registrazione in corso...");
                    this.port.postMessage({ type: "record", buffer: serializedBuffer });
                } else if (this.mode === "recognize") {
                    console.log("🗣️ Riconoscimento in corso...");
                    this.port.postMessage({ type: "recognize", buffer: serializedBuffer });
                }
            }
        }
        return true;
    }
}

registerProcessor("audio-processor", AudioProcessor);
