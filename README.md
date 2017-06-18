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
    - install and configure Go:
    ```
    export GOROOT=/usr/local/go;
    export GOPATH=$HOME/go
    ```
    - download and build Google CodeSearch:
    ```
    go get github.com/sidiandi/codesearch/cmd/...
    ```
    Or, the original Google version: `github.com/google/cmd/...`

# Usage

Mac: <kbd>cmd-alt-shift-F</kbd>  
Windows, Linux: <kbd>ctrl-alt-shift-F</kbd>

# Commands

### Code Search: Toggle

Open *Find with CodeSearch* window

### Code Search: Reindex Project

Reindex project files: there's no option to auto reindex at the moment.

### Index management

If you're using Google CodeSearch, please use `cindex` to purge or manage your index.

# Tips & Tricks

###  ripgrep

Useful `opts`:
```
--max-columns=1024 --type-not=svg
```

### Google CodeSearch

There's a better version in this fork, it supports many options, like configurable exclusions, index path and so on, and provides binaries for all OS: `https://github.com/sidiandi/codesearch`
Useful indexer opts for it:
```
-exclude .gitignore
```

# Contributing

This package needs your help:
- update index on file changes
- better installation docs
