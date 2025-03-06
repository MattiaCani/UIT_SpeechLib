// mfccUtils.js

// Pre-emphasis (Filtro di pre-enfasi)
export function preEmphasis(signal, coeff = 0.97) {
    const emphasizedSignal = [signal[0]]; // Il primo campione rimane invariato
    for (let i = 1; i < signal.length; i++) {
        emphasizedSignal.push(signal[i] - coeff * signal[i - 1]);
    }
    return emphasizedSignal;
}

// Framing e applicazione finestra Hamming
export function frameSignal(signal, frameSize, hopSize) {
    const frames = [];
    for (let i = 0; i + frameSize <= signal.length; i += hopSize) {
        frames.push(signal.slice(i, i + frameSize));
    }
    return frames;
}

// Applicazione della finestra Hamming
export function applyWindow(frame) {
    const N = frame.length;
    const windowedFrame = frame.map((sample, index) => sample * (0.54 - 0.46 * Math.cos((2 * Math.PI * index) / (N - 1))));
    return windowedFrame;
}

// Trasformata di Fourier (FFT)
export function fft(signal) {
    const N = signal.length;
    const real = signal.slice(); // Copia dei dati
    const imag = new Array(N).fill(0);
    const result = [];
    for (let k = 0; k < N; k++) {
        let realSum = 0;
        let imagSum = 0;
        for (let n = 0; n < N; n++) {
            const angle = (2 * Math.PI * k * n) / N;
            realSum += signal[n] * Math.cos(angle);
            imagSum -= signal[n] * Math.sin(angle);
        }
        result[k] = { real: realSum, imag: imagSum };
    }
    return result;
}

// Funzione per ottenere la banca di filtri Mel
export function melFilterBank(nFilters, nFFT, sampleRate) {
    const melFilters = [];
    const melMin = 0; // Frequenza minima in Mel
    const melMax = Math.floor(sampleRate / 2); // Frequenza massima in Mel

    // Converte la frequenza in Mel
    function hzToMel(hz) {
        return 1127 * Math.log(1 + hz / 700);
    }

    // Converte Mel in Hertz
    function melToHz(mel) {
        return 700 * (Math.exp(mel / 1127) - 1);
    }

    const melMinHz = hzToMel(melMin);
    const melMaxHz = hzToMel(melMax);

    const melSpacing = (melMaxHz - melMinHz) / (nFilters + 1);

    for (let i = 0; i < nFilters; i++) {
        const filter = [];
        const melStart = melMinHz + i * melSpacing;
        const melEnd = melStart + melSpacing;

        for (let j = 0; j < nFFT / 2; j++) {
            const hz = melToHz(melStart + j * (melEnd - melStart) / (nFFT / 2));
            filter.push(hz);
        }
        melFilters.push(filter);
    }

    return melFilters;
}

// Funzione di compressione logaritmica
export function logCompress(spectrum) {
    return spectrum.map(x => Math.log(1 + x)); // Applica il logaritmo
}

// Trasformata Coseno Discreta (DCT)
export function dct(input) {
    const N = input.length;
    const result = [];
    for (let k = 0; k < N; k++) {
        let sum = 0;
        for (let n = 0; n < N; n++) {
            sum += input[n] * Math.cos((Math.PI / N) * (n + 0.5) * k);
        }
        result.push(sum);
    }
    return result;
}