# GCC Minifier
REST API for GCC ([Google Closure Compiler](https://developers.google.com/closure/compiler)).
- Built with node.js and express.js 
- Includes jar file of the GCC

## Requirements
- LTS version of Java 

## Installation
```sh
git clone https://github.com/yaircohen7/gcc-minifier.git
cd gcc-minifier
npm i
node index.js
```
## Setup
By default the server will run on port 3030 (also set in the client app)
You can easily change it by making a copy of .env.example to .env and set your desires port over there.
