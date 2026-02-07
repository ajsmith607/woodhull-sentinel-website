#!/bin/bash

# run after:
#   1. creating repository with REPONAME in GitHub Web interface
#      - https://github.com/ajsmith607/woodhull-sentinel-website
#   2. populating .gitignore

USERNAME="ajsmith607" 
REPONAME="woodhull-sentinel-website" 
ORIGIN=git@github.com:"${USERNAME}"/"${REPONAME}".git

git init
git add -A ./
git commit -m "first commit"
git branch -M main
git remote add origin "${ORIGIN}"
git remote set-url origin "${ORIGIN}"
# git push -u origin main


