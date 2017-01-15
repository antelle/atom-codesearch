'use babel';

import path from 'path';

class SearchEnv {
    static getPath(part) {
        if (process.env.GOPATH) {
            return path.join(process.env.GOPATH, 'bin', part);
        } else {
            return part;
        }
    }

    static get csearch() {
        return atom.config.get('atom-codesearch.csearch') || SearchEnv.getPath('csearch');
    }

    static get cindex() {
        return atom.config.get('atom-codesearch.cindex') || SearchEnv.getPath('cindex');
    }

    static get indexBasePath() {
        const packagePaths = atom.packages.getPackageDirPaths();
        return path.join(packagePaths[packagePaths.length - 1], 'atom-codesearch', 'data');
    }

    static get debugMode() {
        return atom.config.get('atom-codesearch.debugMode');
    }
}

export default SearchEnv;
