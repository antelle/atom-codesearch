'use babel';

import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import SearchEnv from './search-env';

class SearchIndexer extends EventEmitter {
    static get instance() {
        return this._instance ? this._instance : this._instance = new SearchIndexer();
    }

    constructor() {
        super();
        this.wait = Promise.resolve();
    }

    reindex() {
        let flags = SearchEnv.opts;
        flags = flags.concat(atom.project.getPaths());
        this.startCIndex(flags);
        this.emit('started');
    }

    purgeIndex() {
        if (this.cindex) {
            this.cindex.removeAllListeners('close');
            this.cindex.kill();
            this.resetCIndex();
        }
        this.startCIndex(['-reset']);
    }

    listIndexed() {
        return new Promise((resolve, reject) => {
            if (SearchEnv.indexBasePath && !fs.existsSync(path.join(SearchEnv.indexBasePath, 'csearchindex'))) {
                return resolve([]);
            }
            this.startCIndex(['-list']);
            let output = [];
            this.cindex.stdout.on('data', data => {
                output.push(data);
            });
            this.cindex.on('close', code => {
                if (code === 1) {
                    return resolve([]);
                }
                if (code) {
                    return reject('Indexer exit code ' + code);
                }
                resolve(Buffer.concat(output)
                    .toString('utf8')
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line)
                );
            });
        });
    }

    startCIndex(flags) {
        if (this.cindex) {
            throw 'Indexing in progress';
        }
        const basePath = SearchEnv.indexBasePath;
        if (basePath && !fs.existsSync(basePath)) {
            fs.mkdirSync(basePath);
        }
        this.wait = new Promise(resolve => this.resolveWait = resolve);
        this.cindex = spawn(SearchEnv.getPath('cindex'), flags,
            basePath ? { env: { CSEARCHINDEX: path.join(basePath, 'csearchindex'), PATH: process.env.PATH } } : undefined
        );
        if (SearchEnv.debugMode) {
            console.log('[cindex] started', basePath, flags);
        }
        this.cindex.unref();
        this.cindex.stderr.setEncoding('utf8');
        this.cindex.stderr.on('data', data => this.onCIndexStdErr(data));
        this.cindex.on('close', code => this.onCIndexExit(code));
        this.cindex.on('error', err => this.onCIndexError(err));
    }

    onCIndexExit(code) {
        if (SearchEnv.debugMode) {
            console.log('[cindex] exit code', code);
        }
        this.resetCIndex();
        this.emit('finished', code === 0);
    }

    onCIndexError(err) {
        if (err && err.code === 'ENOENT') {
            atom.notifications.addError('`cindex` command not found, is it installed?  \n' +
                'You can change the path in atom-codesearch package settings.',
                { dismissable: true });
        }
    }

    onCIndexStdErr(data) {
        if (SearchEnv.debugMode) {
            console.log('[cindex] >', data);
        }
    }

    resetCIndex() {
        this.cindex = null;
        if (this.resolveWait) {
            this.resolveWait();
            this.resolveWait = null;
        }
    }

    get inProgress() {
        return !!this.cindex;
    }
}

export default SearchIndexer;
