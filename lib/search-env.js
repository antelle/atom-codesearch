'use babel';

import path from 'path';

class SearchEnv {
    static getPath(part) {
        if (atom.config.get('atom-codesearch.path')) {
            return path.join(atom.config.get('atom-codesearch.path'), part);
        } else {
            return part;
        }
    }

    static get engine() {
        return atom.config.get('atom-codesearch.engine');
    }

    static get opts() {
        return atom.config.get('atom-codesearch.opts') || '';
    }

    static get commandPath() {
        return SearchEnv.getPath(SearchEnv.engine);
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
