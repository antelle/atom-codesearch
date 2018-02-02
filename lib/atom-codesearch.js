'use babel';

import { CompositeDisposable } from 'atom';
import SearchEngine from './search-engine';
import SearchIndexer from './search-indexer';
import SearchEnv from './search-env';

export default {
    subscriptions: null,
    isActive: false,
    findAndReplace: null,
    projectFindView: null,
    prevScanWasWithCodeSearch: false,

    activate() {
        this.subscriptions = new CompositeDisposable();
        this.subscriptions.add(atom.commands.add('atom-workspace', {
            'code-search:toggle': () => this.toggle()
        }));
        this.subscriptions.add(atom.commands.add('atom-workspace', {
            'code-search:reindex-project': () => this.reindex()
        }));
        this.subscriptions.add(atom.commands.add('atom-workspace', {
            'project-find:show': () => this.projectFindToggle(),
            'project-find:toggle': () => this.projectFindToggle()
        }));

        atom.packages.activatePackage('find-and-replace').then(findAndReplace => {
            this.findAndReplace = findAndReplace;
            this.projectFindView = findAndReplace.mainModule.projectFindView;
            if (!this.projectFindView) {
                return;
            }
            this.subscribeProjectFindView();
            this.overrideProjectFindModel();
            this.overrideProjectScan();
        });

        this.subscribeSearchIndexer();
    },

    deactivate() {
        this.subscriptions.dispose();
    },

    reindex() {
        if (SearchEnv.engine === 'csearch') {
            SearchEngine.reindex();
        }
    },

    toggle() {
        let target = document.querySelector('atom-workspace');
        if (atom.commands.dispatch(target, 'project-find:show')) {
            atom.packages.activatePackage('find-and-replace').then(() => {
                this.setActive(true);
            });
        }
    },

    projectFindToggle() {
        this.setActive(false);
    },

    setActive(active) {
        if (this.isActive === active) {
            return;
        }
        this.isActive = active;
        if (!this.projectFindView) {
            return;
        }
        if (active) {
            this.projectFindView.clearMessages();
            let infoMessage = 'Find in Project with <span class="highlight-info">' + SearchEnv.engine + '</span>';
            const el = this.projectFindView.element.getElementsByClassName('description')[0];
            if (el) {
                el.innerHTML = infoMessage;
            }
            this.projectFindView.setInfoMessage(infoMessage);
            this.projectFindView.model.findOptions.codeSearch = true;
        } else {
            this.projectFindView.clearMessages();
            delete this.projectFindView.model.findOptions.codeSearch;
        }
    },

    subscribeProjectFindView: function() {
        // const viewConfirm = this.projectFindView.confirm.bind(this.projectFindView);
        // this.projectFindView.confirm = () => this.searchConfirm() || viewConfirm();
        this.subscriptions.add(atom.commands.add(this.projectFindView.element, {
            'core:close': () => this.searchClosed(),
            'core:cancel': () => this.searchClosed()
        }));
    },

    searchClosed() {
        this.setActive(false);
    },

    overrideProjectFindModel() {
        const modelShouldRerunSearch = this.projectFindView.model.shouldRerunSearch.bind(this.projectFindView.model);
        this.projectFindView.model.shouldRerunSearch = (...args) => {
            if (this.prevScanWasWithCodeSearch !== this.isActive) {
                return true;
            }
            return modelShouldRerunSearch(...args);
        };
    },

    overrideProjectScan() {
        let workspaceScan = atom.workspace.scan.bind(atom.workspace);
        atom.workspace.scan = (...args) => this.scan(...args) || workspaceScan(...args);
    },

    scan(...args) {
        this.prevScanWasWithCodeSearch = this.isActive;
        if (!this.isActive) {
            return undefined;
        }
        this.searching = true;
        if (SearchIndexer.instance.inProgress) {
            setTimeout(() => this.setStatusMessage('Indexing...'));
        }
        let promise = SearchEngine.scan(...args);
        promise.then(() => { this.searching = false; });
        return promise;
    },

    setStatusMessage(message) {
        if (!this.searching) {
            return;
        }
        const uri = 'atom://find-and-replace/project-results';
        let pane = atom.workspace.paneForURI(uri);
        if (!pane) {
            return;
        }
        let item = pane.itemForURI(uri)
        if (!item || !item.previewCount) {
            return;
        }
        item.previewCount.text(message)
    },

    subscribeSearchIndexer() {
        SearchIndexer.instance.on('started', () => this.setStatusMessage('Indexing...'));
        SearchIndexer.instance.on('finished', () => this.setStatusMessage('Searching...'));
    }
};
