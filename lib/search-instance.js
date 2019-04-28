'use babel';

import path from 'path';
import readline from 'readline';
import { spawn } from 'child_process';
import SearchEnv from './search-env';
import SearchIndexer from './search-indexer';

const LINE_REGEX = /^((?:[A-Z]:\\)?[^:]+):(\d+):(.+)$/;

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
        let flags = SearchEnv.opts;
        if (SearchEnv.engine !== 'pt' && SearchEnv.engine !== 'ag' ) {
            flags.push('-n');
        }
        if (this.regex.ignoreCase) {
            flags.unshift('-i');
        }
        flags.push(this.regex.source);
        if (SearchEnv.engine === 'csearch') {
            flags.unshift('-f', this.getSearchPathsRegex());
            this.ensureIndexExists()
                .then(() => this.startCSearch(flags))
                .catch(() => this.resolve());
        } else {
            flags = flags.concat(this.getSearchPaths(true));
            this.startCSearch(flags);
        }
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
                if (SearchEnv.debugMode) {
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
                if (SearchEnv.debugMode) {
                    console.error('[csearch] cindex error', err);
                }
                this.iterator(undefined, { message: 'Project indexing error: ' + err });
                throw err;
            })
        });
    }

    getSearchPaths(join) {
        let projectPaths = atom.project.getPaths();
        let searchPaths = this.options && this.options.paths || [];
        if (!searchPaths || searchPaths[0] === "") {
            searchPaths = [];
            for (let path of projectPaths) {
                if (path[path.length - 1] !== '/') {
                    path = SearchEnv.engine !== 'csearch' ? path + '/' : path;
                    searchPaths.push(path);
                }
            }
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
                    .map(pp => join ? path.join(pp, searchPath) : (pp + '*' + searchPath))
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
        const opts = SearchEnv.engine === 'csearch' && SearchEnv.indexBasePath ?
            { env: { CSEARCHINDEX: path.join(SearchEnv.indexBasePath, 'csearchindex'), PATH: process.env.PATH } } : undefined;
        this.csearch = spawn(SearchEnv.commandPath, flags, opts);
        if (SearchEnv.debugMode) {
            console.log('[csearch] started', SearchEnv.commandPath, flags);
        }
        this.csearch.unref();
        this.stdoutLineReader = readline.createInterface({ input: this.csearch.stdout });
        this.stderrLineReader = readline.createInterface({ input: this.csearch.stderr });
        this.stdoutLineReader.on('line', line => this.onOutLine(line));
        this.stderrLineReader.on('line', line => this.onErrLine(line));
        this.csearch.on('close', code => this.onCSearchExit(code));
        this.csearch.on('error', err => this.onCSearchError(err, path.basename(SearchEnv.commandPath)));
    }

    onCSearchExit(code) {
        if (SearchEnv.debugMode) {
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

    onCSearchError(err, cmd) {
        if (err && err.code === 'ENOENT') {
            const links = {
                rg: 'https://github.com/BurntSushi/ripgrep#installation',
                csearch: 'https://github.com/sidiandi/codesearch#readme',
                pt: 'https://github.com/monochromegane/the_platinum_searcher#installation',
                ag: 'https://github.com/ggreer/the_silver_searcher#installing'
            };
            const link = links[cmd];
            atom.notifications.addError('`' + cmd + '` command not found, is it installed?  \n' +
                'You can change the path in atom-codesearch package settings.', {
                dismissable: true,
                buttons: link ? [{
                    text: 'How to install?',
                    onDidClick: function() {
                        require('electron').shell.openExternal(link);
                    }
                }] : null
            });
            this.iterator(undefined, { message: 'Search error: `' + cmd + '` command not found' });
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
                            [row, lineMatch.index + lineMatch[0].length]],
                        leadingContextLines: [],
                        trailingContextLines: [],
                    });
                }
            } while (lineMatch);
        }
    }

    onErrLine(line) {
        if (line.startsWith('open') && line.endsWith('no such file or directory')) {
            return;
        }
        if (SearchEnv.debugMode) {
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
