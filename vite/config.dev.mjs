import { defineConfig } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const persistedTuningModulePath = path.join(
    projectRoot,
    'src/game/player/tuning/player_tuning_persisted.generated.ts'
);

const isValidSnapshotPayload = (value) => {
    return typeof value === 'object'
        && value !== null
        && value.version === 1
        && typeof value.raw === 'object'
        && value.raw !== null;
};

export default defineConfig({
    base: './',
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser']
                }
            }
        },
    },
    server: {
        port: 8080
    },
    plugins: [{
        name: 'player-tuning-save-endpoint',
        configureServer(server) {
            server.middlewares.use('/__dev/save-player-tuning', async (req, res) => {
                if (req.method !== 'POST') {
                    res.statusCode = 405;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ message: 'method not allowed' }));
                    return;
                }

                try {
                    const body = await new Promise((resolve, reject) => {
                        let raw = '';
                        req.on('data', (chunk) => {
                            raw += chunk;
                        });
                        req.on('end', () => resolve(raw));
                        req.on('error', reject);
                    });
                    const payload = JSON.parse(body);
                    if (!isValidSnapshotPayload(payload)) {
                        res.statusCode = 400;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ message: 'invalid tuning snapshot payload' }));
                        return;
                    }

                    const moduleSource = [
                        "import type { PlayerTuningSnapshot } from './player_tuning_types';",
                        '',
                        'export const PLAYER_TUNING_PERSISTED_SNAPSHOT: PlayerTuningSnapshot = '
                            + `${JSON.stringify(payload, null, 4)};`,
                        ''
                    ].join('\n');

                    await fs.writeFile(persistedTuningModulePath, moduleSource, 'utf8');
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ message: 'saved player tuning to project' }));
                } catch (error) {
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({
                        message: error instanceof Error ? error.message : 'failed to save player tuning'
                    }));
                }
            });
        }
    }
});
