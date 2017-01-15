'use babel';

import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import SearchEnv from './search-env';

class SearchIndexer {
    static get instance() {
        return this._instance ? this._instance : this._instance = new SearchIndexer();
    }

    reindex() {
        const paths = atom.project.getPaths();
        this.startCIndex(paths);
    }

    purgeIndex() {
        if (this.cindex) {
            this.cindex.removeAllListeners('close');
            this.cindex.kill();
            this.cindex = null;
        }
        this.startCIndex(['-reset']);
    }

    startCIndex(flags) {
        const basePath = SearchEnv.indexBasePath;
        if (!fs.existsSync(basePath)) {
            fs.mkdirSync(basePath);
        }
        const indexPath = path.join(basePath, 'csearchindex');
        this.cindex = spawn(SearchEnv.cindex, flags, {
            env: { CSEARCHINDEX: indexPath }
        });
        if (SearchEnv.debugMode) {
            console.log('[cindex] started', indexPath, flags);
        }
        this.cindex.unref();
        this.cindex.stderr.setEncoding('utf8');
        this.cindex.stderr.on('data', data => console.log('[cindex] > ', data));
        this.cindex.on('close', code => this.onCIndexExit(code));
    }

    onCIndexExit(code) {
        if (SearchEnv.debugMode) {
            console.log('[cindex] exit code', code);
        }
        this.cindex = null;
    }
}

export default SearchIndexer;
