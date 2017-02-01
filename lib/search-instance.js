'use babel';

import path from 'path';
import readline from 'readline';
import { spawn } from 'child_process';
import SearchEnv from './search-env';
import SearchIndexer from './search-indexer';

const LINE_REGEX = /^([^:]+):(\d+):(.+)$/;

class SearchInstance {
    constructor(regex, options, iterator) {
        this.regex = regex;
        this.options = options;
        this.iterator = iterator;
        this.promise = new Promise(resolve => {
            this.resolve = resolve;
            this.initResultExclusions();
            this.runSearch();
        });
        this.promise.cancel = () => this.cancel();
        this.debugMode = SearchEnv.debugMode;
    }

    initResultExclusions() {
        if (atom.config.get('core.excludeVcsIgnoredPaths')) {
            this.projectRepos = atom.project.getRepositories().filter(repo => repo);
        }
        let ignoredFiles = atom.config.get('core.ignoredNames');
        if (ignoredFiles && ignoredFiles.length) {
            this.ignoredFilesRegex = new RegExp('[\\\\/]' + ignoredFiles.map(f => '(' + this.pathToRegex(f) + ')').join('|'));
        }
    }

    runSearch() {
        let flags = ['-n', this.regex.source];
        if (this.regex.ignoreCase) {
            flags.unshift('-i');
        }
        flags.unshift('-f', this.getSearchPathsRegex());
        this.ensureIndexExists()
            .then(() => this.startCSearch(flags))
            .catch(() => this.resolve());
    }

    ensureIndexExists() {
        const idx = SearchIndexer.instance;
        return idx.wait.then(() => {
            if (this.cancelled) {
                throw 'Search cancelled';
            }
            return idx.listIndexed().then(indexed => {
                let newPaths = atom.project.getPaths().filter(path => indexed.indexOf(path) < 0);
                if (!newPaths.length) {
                    return;
                }
                if (this.debugMode) {
                    console.log('[csearch] missing paths', newPaths);
                }
                idx.reindex();
                return new Promise((resolve, reject) => {
                    idx.once('finished', success => {
                        if (!success) {
                            this.iterator(undefined, { message: 'Project indexing error' });
                            return reject();
                        }
                        resolve();
                    });
                });
            }).catch(err => {
                if (this.debugMode) {
                    console.error('[csearch] cindex error', err);
                }
                this.iterator(undefined, { message: 'Project indexing error: ' + err });
                throw err;
            })
        });
    }

    getSearchPaths() {
        let projectPaths = atom.project.getPaths();
        let searchPaths = this.options && this.options.paths || [];
        if (!searchPaths || !searchPaths.length) {
            return projectPaths;
        }
        let foundPaths = [];
        searchPaths.forEach(searchPath => {
            if (!searchPath) {
                return;
            }
            if (path.isAbsolute(searchPath)) {
                return foundPaths.push(searchPath);
            }
            let firstFolder = searchPath.split(/[\\\/]/)[0];
            let matchingProjectPaths = projectPaths.filter(pp => pp.endsWith(firstFolder));
            if (matchingProjectPaths.length) {
                foundPaths = foundPaths.concat(matchingProjectPaths
                    .map(pp => path.join(pp, searchPath.substr(firstFolder.length + 1)))
                );
            } else {
                foundPaths = foundPaths.concat(projectPaths
                    .map(pp => pp + '*' + searchPath)
                );
            }
        });
        return foundPaths;
    }

    getSearchPathsRegex() {
        return '^(' + this.getSearchPaths().map(p => '(' + this.pathToRegex(p) + ')').join('|') + ')';
    }

    pathToRegex(path) {
        return path
            .replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
            .replace(/\*+/g, '.*')
            .replace(/"/g, '""');
    }

    startCSearch(flags) {
        if (this.cancelled) {
            return this.resolve();
        }
        const indexPath = path.join(SearchEnv.indexBasePath, 'csearchindex');
        this.csearch = spawn(SearchEnv.csearch, flags, {
            env: { CSEARCHINDEX: indexPath }
        });
        if (this.debugMode) {
            console.log('[csearch] started', indexPath, flags);
        }
        this.csearch.unref();
        this.stdoutLineReader = readline.createInterface({ input: this.csearch.stdout });
        this.stderrLineReader = readline.createInterface({ input: this.csearch.stderr });
        this.stdoutLineReader.on('line', line => this.onOutLine(line));
        this.stderrLineReader.on('line', line => this.onErrLine(line));
        this.csearch.on('close', code => this.onCSearchExit(code));
        this.csearch.on('error', err => this.onCSearchError(err));
    }

    onCSearchExit(code) {
        if (this.debugMode) {
            console.log('[csearch] exit code', code);
        }
        if (this.fileRes) {
            this.iterator(this.fileRes);
            this.fileRes = null;
        }
        if (this.stdoutLineReader) {
            this.stdoutLineReader.close();
            this.stdoutLineReader = null;
        }
        if (this.stderrLineReader) {
            this.stderrLineReader.close();
            this.stderrLineReader = null;
        }
        this.csearch = null;
        this.resolve();
    }

    onCSearchError(err) {
        if (err && err.code === 'ENOENT') {
            atom.notifications.addError('`csearch` command not found, is it installed?  \n' +
                'You can change the path in atom-codesearch package settings.',
                { dismissable: true });
            this.iterator(undefined, { message: 'Search error: `csearch` command not found' });
        }
    }

    onOutLine(line) {
        const match = LINE_REGEX.exec(line);
        if (!match) {
            return;
        }
        const [, filePath, lineNumber, lineText] = match;
        if (lineText) {
            if (this.ignoredFilesRegex && this.ignoredFilesRegex.test(filePath)) {
                return;
            }
            if (this.projectRepos && this.projectRepos.some(repo => repo.isPathIgnored(filePath))) {
                return;
            }
            if (this.fileRes && this.fileRes.filePath !== filePath) {
                this.iterator(this.fileRes);
                this.fileRes = null;
            }
            if (!this.fileRes) {
                this.fileRes = {
                    filePath: filePath,
                    matches: []
                };
            }
            const row = lineNumber - 1;
            let lineMatch;
            do {
                lineMatch = this.regex.exec(lineText);
                if (lineMatch) {
                    this.fileRes.matches.push({
                        lineText: lineText,
                        lineTextOffset: 0,
                        matchText: lineMatch[0],
                        range: [[row, lineMatch.index],
                            [row, lineMatch.index + lineMatch[0].length]]
                    });
                }
            } while (lineMatch);
        }
    }

    onErrLine(line) {
        if (line.startsWith('open') && line.endsWith('no such file or directory')) {
            return;
        }
        if (this.debugMode) {
            console.error('[csearch] error', line);
        }
        this.iterator(undefined, { message: line });
    }

    cancel() {
        this.cancelled = true;
        if (this.stdoutLineReader) {
            this.stdoutLineReader.removeAllListeners('line');
        }
        if (this.csearch) {
            this.csearch.kill();
        }
    }
}

export default SearchInstance;
