// webpack.config.js

const path = require('path');

module.exports = {
    entry: './speech-api-wrapper.js', // Il file che esporta la classe
    output: {
        filename: 'speech-api.js',
        path: path.resolve(__dirname, 'dist'),
        library: 'SpeechAPI', // Nome della libreria globale
        libraryTarget: 'umd',  // UMD per compatibilità in vari ambienti (browser, Node.js, CommonJS)
        globalObject: 'this', // Rende la libreria compatibile in ambienti come Node.js e browser
    },
    mode: 'production', // Modalità produzione
};
