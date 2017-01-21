# Atom CodeSearch

Super-fast search for code using Google CodeSearch.

You will find this package useful if searching across your code takes a lot of time. With CodeSearch, it's a couple of seconds.

# Installation

1. install this package
2. install and configure Go
3. download and build Google CodeSearch

Something like this:

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

### Code Search: Reindex Project

Reindex files in project

### Code Search: Purge Index

Purge index, e.g., when there are some strange problems with it

# Tricky stuff

It's CodeSearch engine, not this package, who decides if a file is a text file or not, so it might skip something. You will NOT be notified of that. I strongly recommend that you look into [these constants](https://github.com/google/codesearch/blob/master/index/write.go#L88) and tune them if required. Anyway, to avoid missing results, always search for critical things using plain old slow method.

# Contributing

This package needs your help:
- make it work on different OS
- update index on file changes
- simple installation, without a need to configure go
- don't index ignored directories (e.g. node_modules)
