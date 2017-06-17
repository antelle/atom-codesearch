# Atom CodeSearch

Super-fast search for code using different search engines:

- ripgrep (`rg`)
- The Silver Searcher (`ag`)
- The Platinum Searcher (`pt`)
- Google CodeSearch (`csearch`)

You will find this package useful if searching across your code takes a lot of time. With CodeSearch, it's a couple of seconds.

# Installation

1. install this package
2. install your preferred search engine:

  - [ripgrep](https://github.com/BurntSushi/ripgrep)
  - [The Silver Searcher](https://github.com/ggreer/the_silver_searcher)
  - [The Platinum Searcher](https://github.com/monochromegane/the_platinum_searcher)
  - [Google CodeSearch](https://github.com/google/codesearch)
    - install and configure Go
    - download and build Google CodeSearch:

        ```
        export GOROOT=/usr/local/go
        export GOPATH=$HOME/go

        go get github.com/google/codesearch/cmd/{cindex,csearch}
        ```

# Usage

Mac: <kbd>cmd-alt-shift-F</kbd>  
Windows, Linux: <kbd>ctrl-alt-shift-F</kbd>

# Commands

### Code Search: Toggle

Open *Find with CodeSearch* window

### Index management

If you're using Google CodeSearch, please use `cindex` to purge or manage your index.

# Tips & Tricks

Useful `opts` if you're using ripgrep:
```
--max-columns=1024 --type-not=svg
```

# Tricky stuff

If you're using CodeSearch: it's CodeSearch engine, not this package, who decides if a file is a text file or not, so it might skip something. You will NOT be notified of that. I strongly recommend that you look into [these constants](https://github.com/google/codesearch/blob/master/index/write.go#L88) and tune them if required. Anyway, to avoid missing results, always search for critical things using plain old slow method.

# Contributing

This package needs your help:
- make it work on different OS
- update index on file changes
- simple installation, without a need to configure go
