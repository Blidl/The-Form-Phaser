import { defineConfig } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const persistedTuningModulePath = path.join(
    projectRoot,
    'src/game/player/tuning/player_tuning_persisted.generated.ts'
);
const logicScriptsJsonPath = path.join(
    projectRoot,
    'src/game/world/runtime/data/logic_scripts.json'
);
const logicScriptsJsonRelativeSuffix = '/src/game/world/runtime/data/logic_scripts.json';
const logicScriptsDataDirectoryPath = path.join(
    projectRoot,
    'src/game/world/runtime/data'
);
const logicScriptsDirectoryPath = path.join(
    logicScriptsDataDirectoryPath,
    'scripts'
);
const logicScriptsDirectoryRelativePrefix = '/src/game/world/runtime/data/scripts/';

const toPosixPath = (value) => {
    return value.replaceAll('\\', '/');
};

const normalizeManifestScriptPath = (value) => {
    return value.replaceAll('\\', '/').trim().replace(/^\.\/+/, '').replace(/^\/+/, '');
};

const toJsonErrorMessage = (error, fallback) => {
    return error instanceof Error ? error.message : fallback;
};

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
    }, {
        name: 'logic-scripts-read-endpoint',
        configureServer(server) {
            server.middlewares.use('/__theform/logic-scripts', async (req, res) => {
                if (req.method !== 'GET') {
                    res.statusCode = 405;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ message: 'method not allowed' }));
                    return;
                }

                try {
                    const rawJson = await fs.readFile(logicScriptsJsonPath, 'utf8');
                    const payload = JSON.parse(rawJson);
                    const payloadRoot = typeof payload === 'object' && payload !== null
                        ? payload
                        : null;
                    const hasManifestShape = payloadRoot && Array.isArray(payloadRoot.scriptFiles);
                    if (!hasManifestShape) {
                        res.statusCode = 200;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify(payload));
                        return;
                    }

                    const scriptFiles = payloadRoot.scriptFiles;
                    const scripts = [];
                    const usedPaths = new Set();
                    for (let index = 0; index < scriptFiles.length; index += 1) {
                        const rawPath = scriptFiles[index];
                        if (typeof rawPath !== 'string' || rawPath.trim().length <= 0) {
                            throw new Error(`logic_scripts.json scriptFiles[${index}] must be a non-empty string path.`);
                        }
                        const scriptPath = normalizeManifestScriptPath(rawPath);
                        if (usedPaths.has(scriptPath)) {
                            throw new Error(`logic_scripts.json scriptFiles has duplicate path "${scriptPath}".`);
                        }
                        usedPaths.add(scriptPath);
                        const absoluteScriptPath = path.resolve(logicScriptsDataDirectoryPath, scriptPath);
                        const normalizedAbsoluteScriptPath = path.normalize(absoluteScriptPath);
                        const normalizedScriptsDirectoryPath = path.normalize(logicScriptsDirectoryPath);
                        if (
                            normalizedAbsoluteScriptPath !== normalizedScriptsDirectoryPath
                            && !normalizedAbsoluteScriptPath.startsWith(`${normalizedScriptsDirectoryPath}${path.sep}`)
                        ) {
                            throw new Error(`logic_scripts.json scriptFiles path "${scriptPath}" must stay under src/game/world/runtime/data/scripts/.`);
                        }
                        const rawScriptJson = await fs.readFile(normalizedAbsoluteScriptPath, 'utf8');
                        scripts.push(JSON.parse(rawScriptJson));
                    }
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ scripts }));
                } catch (error) {
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({
                        message: toJsonErrorMessage(error, 'failed to load logic scripts')
                    }));
                }
            });
        }
    }, {
        name: 'logic-scripts-hmr-suppressor',
        handleHotUpdate(context) {
            const normalizedFilePath = toPosixPath(context.file);
            const normalizedTargetPath = toPosixPath(logicScriptsJsonPath);
            const isLogicScriptsJsonChange = normalizedFilePath === normalizedTargetPath
                || normalizedFilePath.endsWith(logicScriptsJsonRelativeSuffix);
            const isLogicScriptAssetFileChange = normalizedFilePath.includes(logicScriptsDirectoryRelativePrefix);
            if (!isLogicScriptsJsonChange && !isLogicScriptAssetFileChange) {
                return;
            }
            context.server.config.logger.info(
                'logic script assets changed; use Logic tab Reload Scripts.',
                { timestamp: true }
            );
            return [];
        }
    }]
});
