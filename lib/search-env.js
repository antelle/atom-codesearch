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

    static getOpts(key) {
        return (atom.config.get(key) || '').match(/(?:(?:'[^']+')|\S)+/g) || [];
    }

    static get engine() {
        return atom.config.get('atom-codesearch.engine');
    }

    static get opts() {
        return this.getOpts('atom-codesearch.opts');
    }

    static get optsIndex() {
        return this.getOpts('atom-codesearch.optsIndex');
    }

    static get commandPath() {
        return SearchEnv.getPath(SearchEnv.engine);
    }

    static get indexBasePath() {
        if (atom.config.get('atom-codesearch.useGlobalCodeSearchIndex')) {
            return null;
        }
        const packagePaths = atom.packages.getPackageDirPaths();
        return path.join(packagePaths[packagePaths.length - 1], 'atom-codesearch', 'data');
    }

    static get debugMode() {
        return atom.config.get('atom-codesearch.debugMode');
    }
}

export default SearchEnv;
