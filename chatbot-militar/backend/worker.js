// worker.js
const { Worker } = require('bullmq');
const Redis = require('ioredis');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { Recognizer } = require('vosk');
const db = require('./db');

ffmpeg.setFfmpegPath(ffmpegPath);

function initWorker(model, io) {
  const redisConfig = {
    host: '127.0.0.1',
    port: 6379,
    maxRetriesPerRequest: null,
    retryStrategy(times) {
      // Retry every 15 seconds in the background
      return 15000;
    }
  };
  
  let redisClient;
  try {
    redisClient = new Redis(redisConfig);
    redisClient.on('error', () => {
      // Silence background connection warnings to avoid console spam
    });
  } catch (err) {
    console.error('[Worker] Error instantiating Redis client:', err.message);
  }
  
  const worker = new Worker('chat', async job => {
    const { requestId, filePath, socketId } = job.data;
    console.log(`[Worker] Processing job ${job.id} for request ${requestId}...`);
    
    // Resolve absolute path for the input file
    const inputPath = path.resolve(__dirname, filePath);
    const outputPath = inputPath + '.wav';
    
    try {
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Input file not found at ${inputPath}`);
      }

      // Perform speech transcription
      const text = await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .toFormat('wav')
          .audioChannels(1)
          .audioFrequency(16000)
          .on('end', () => {
            if (!fs.existsSync(outputPath)) {
              return reject(new Error('Output wav file was not created'));
            }
            const fileStream = fs.createReadStream(outputPath, { highWaterMark: 4096 });
            const rec = new Recognizer({ model: model, sampleRate: 16000 });

            fileStream.on('data', (chunk) => {
              rec.acceptWaveform(chunk);
            });

            fileStream.on('end', () => {
              const result = rec.finalResult();
              rec.free();
              resolve(result.text);
            });

            fileStream.on('error', (err) => {
              rec.free();
              reject(err);
            });
          })
          .on('error', (err) => {
            reject(err);
          })
          .save(outputPath);
      });

      console.log(`[Worker] Transcription result: "${text}"`);
      
      // Clean up files
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

      // Save to database
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE requests SET status = ?, result = ? WHERE id = ?',
          ['done', text, requestId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Emit notification to client via Socket.io
      if (io) {
        if (socketId) {
          console.log(`[Worker] Emitting result to socket ${socketId}`);
          io.to(socketId).emit('result', { requestId, text });
        } else {
          console.log(`[Worker] Emitting result to all sockets (broadcast)`);
          io.emit('result', { requestId, text });
        }
      }

    } catch (error) {
      console.error(`[Worker] Error processing request ${requestId}:`, error);
      
      // Clean up files on error
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

      // Update database status
      db.run('UPDATE requests SET status = ?, result = ? WHERE id = ?', ['error', error.message, requestId]);

      if (io) {
        if (socketId) {
          io.to(socketId).emit('result-error', { requestId, error: error.message });
        } else {
          io.emit('result-error', { requestId, error: error.message });
        }
      }
    }
  }, { 
    connection: redisClient
  });

  worker.on('error', err => {
    // Silence queue connection logs to avoid console spam
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  console.log('👷 Worker initialized successfully');
  return worker;
}

module.exports = { initWorker };
