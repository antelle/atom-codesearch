'use babel';

import { CompositeDisposable } from 'atom';
import SearchEngine from './search-engine';

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
            'code-search:reindex': () => this.reindex()
        }));
        this.subscriptions.add(atom.commands.add('atom-workspace', {
            'code-search:purge-index': () => this.purgeIndex()
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
    },

    deactivate() {
        this.subscriptions.dispose();
    },

    toggle() {
        let target = document.querySelector('atom-workspace');
        if (atom.commands.dispatch(target, 'project-find:show')) {
            atom.packages.activatePackage('find-and-replace').then(() => {
                this.setActive(true);
            });
        }
    },

    reindex() {
        SearchEngine.reindex();
    },

    purgeIndex() {
        SearchEngine.purgeIndex();
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
            let infoMessage = this.projectFindView.descriptionLabel.html()
                .replace('Find in Project', 'Find in Project with CodeSearch');
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
        const modelShoudldRerunSearch = this.projectFindView.model.shoudldRerunSearch.bind(this.projectFindView.model);
        this.projectFindView.model.shoudldRerunSearch = (...args) => {
            if (this.prevScanWasWithCodeSearch !== this.isActive) {
                return true;
            }
            return modelShoudldRerunSearch(...args);
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
        return SearchEngine.scan(...args);
    }
};
