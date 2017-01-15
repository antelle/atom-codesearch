'use babel';

import SearchIndexer from './search-indexer';
import SearchInstance from './search-instance';

class SearchEngine {
    static reindex() {
        SearchIndexer.instance.reindex();
    }

    static purgeIndex() {
        SearchIndexer.instance.purgeIndex();
    }

    static scan(regex, options, iterator) {
        if (typeof options === 'function') {
            iterator = options;
            options = null;
        }
        let search = new SearchInstance(regex, options, iterator);
        return search.promise;
    }
}

export default SearchEngine;
