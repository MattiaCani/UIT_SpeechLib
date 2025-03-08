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
        if (!this.port || !inputs || inputs.length === 0 || !inputs[0]) {
            return false; // Interrompe l'elaborazione se non ci sono dati validi
        }

        console.log("process avviato");
        const input = inputs[0];

        if (input && input.length > 0) {
            const buffer = input[0];

            const sum = buffer.reduce((acc, val) => acc + Math.abs(val), 0);
            const average = sum / buffer.length;

            if (average > 0.0001) {
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

        return this.port !== null; // Se this.port è null, interrompe l'elaborazione
    }
}

registerProcessor("audio-processor", AudioProcessor);
