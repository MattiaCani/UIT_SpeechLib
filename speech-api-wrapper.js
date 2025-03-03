class SpeechAPI {
    constructor() {
        this.synth = window.speechSynthesis;
        this.recognition = null;
        this.isRecognizing = false;
        this.initRecognition();
    }

    speak(text) {
        const utterance = new SpeechSynthesisUtterance(text);
        this.synth.speak(utterance);
    }

    initRecognition() {
        if ('webkitSpeechRecognition' in window) {
            this.recognition = new webkitSpeechRecognition();
            this.recognition.continuous = false;  // Disabilita il riconoscimento continuo
            this.recognition.interimResults = false;  // Mostra solo i risultati definitivi
            this.recognition.lang = 'it-IT';  // Imposta la lingua italiana

            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                this.onRecognitionResultCallback(transcript);
            };

            this.recognition.onend = () => {
                this.isRecognizing = false;
                this.onRecognitionEndCallback();
            };

            this.recognition.onerror = (event) => {
                console.error('Errore riconoscimento vocale:', event.error);
                this.onRecognitionErrorCallback(event.error);
                this.isRecognizing = false;
            };
        } else {
            console.error('Riconoscimento vocale non supportato.');
        }
    }

    startRecognition() {
        if (this.recognition && !this.isRecognizing) {
            this.recognition.start();  // Avvia il riconoscimento vocale
            this.isRecognizing = true;
        }
    }

    stopRecognition() {
        if (this.recognition && this.isRecognizing) {
            this.recognition.stop();  // Ferma il riconoscimento vocale
            this.isRecognizing = false;
        }
    }

    onRecognitionResult(callback) {
        this.onRecognitionResultCallback = callback;
    }

    onRecognitionEnd(callback) {
        this.onRecognitionEndCallback = callback;
    }

    onRecognitionError(callback) {
        this.onRecognitionErrorCallback = callback;
    }
}

module.exports = SpeechAPI;
