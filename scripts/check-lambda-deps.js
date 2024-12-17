#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const LAMBDA_SRC_DIR = path.join(__dirname, '..', 'src', 'connectors', 'lambda');
const LAMBDA_DIST_DIR = path.join(__dirname, '..', 'dist-lambda');
const SRC_DIR = path.join(__dirname, '..', 'src');

// Load webpack config
const webpackConfig = require('../webpack.config.js');
const baseConfig = Array.isArray(webpackConfig) ? webpackConfig[0] : webpackConfig;

// Extract raw file patterns from webpack config
const rawFilePatterns = baseConfig.module.rules
    .filter(rule => rule.use && (Array.isArray(rule.use) ? rule.use.some(u => u.loader === 'raw-loader') : rule.use.loader === 'raw-loader'))
    .map(rule => rule.test)
    .filter(Boolean);

// Extract provided plugins from webpack config
const providedModules = {};
baseConfig.plugins.forEach(plugin => {
    if (plugin.constructor.name === 'ProvidePlugin' && plugin.definitions) {
        // Convert definitions to module names
        Object.entries(plugin.definitions).forEach(([key, value]) => {
            providedModules[key] = typeof value === 'string' ? value : value.toString();
        });
    }
});

// ANSI colors
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m'
};

function log(msg, color = '') {
    console.log(`${color}${msg}${colors.reset}`);
}

// Cache for requires to avoid circular dependencies
const requireCache = new Set();

// Check if a file is a JavaScript file
function isJavaScriptFile(filePath) {
    return filePath.endsWith('.js') || filePath.endsWith('.jsx') || filePath.endsWith('.mjs');
}

// Find all require statements in a source file and its dependencies
function findAllRequires(filePath, baseDir = LAMBDA_SRC_DIR) {
    const requires = new Set();
    const rawFiles = new Set();
    
    if (requireCache.has(filePath) || !isJavaScriptFile(filePath)) {
        return { requires, rawFiles };
    }
    requireCache.add(filePath);

    try {
        const sourceCode = fs.readFileSync(filePath, 'utf8');
        const ast = parse(sourceCode, {
            sourceType: 'module',
            plugins: ['jsx']
        });

        traverse(ast, {
            CallExpression(nodePath) {
                // Direct requires: require('module')
                if (nodePath.node.callee.name === 'require') {
                    const arg = nodePath.node.arguments[0];
                    if (arg.type === 'StringLiteral') {
                        const value = arg.value;
                        if (!value.startsWith('.') && !value.startsWith('/')) {
                            requires.add(value);
                        } else {
                            // Handle local requires
                            const localPath = path.join(path.dirname(filePath), value);
                            try {
                                const resolvedPath = require.resolve(localPath);
                                // Check if it's a raw file
                                const basename = path.basename(resolvedPath);
                                if (rawFilePatterns.some(pattern => pattern.test(basename))) {
                                    rawFiles.add(resolvedPath);
                                } else if (isJavaScriptFile(resolvedPath)) {
                                    const { requires: localRequires, rawFiles: localRawFiles } = findAllRequires(resolvedPath, baseDir);
                                    localRequires.forEach(r => requires.add(r));
                                    localRawFiles.forEach(r => rawFiles.add(r));
                                }
                            } catch (err) {
                                if (!err.message.includes('Cannot find module')) {
                                    log(`Error resolving ${localPath}:`, colors.red);
                                    log(err.message, colors.red);
                                }
                            }
                        }
                    }
                }
            },
            ImportDeclaration(nodePath) {
                const source = nodePath.node.source.value;
                if (!source.startsWith('.') && !source.startsWith('/')) {
                    requires.add(source);
                } else {
                    // Handle local imports
                    const localPath = path.join(path.dirname(filePath), source);
                    try {
                        const resolvedPath = require.resolve(localPath);
                        // Check if it's a raw file
                        const basename = path.basename(resolvedPath);
                        if (rawFilePatterns.some(pattern => pattern.test(basename))) {
                            rawFiles.add(resolvedPath);
                        } else if (isJavaScriptFile(resolvedPath)) {
                            const { requires: localRequires, rawFiles: localRawFiles } = findAllRequires(resolvedPath, baseDir);
                            localRequires.forEach(r => requires.add(r));
                            localRawFiles.forEach(r => rawFiles.add(r));
                        }
                    } catch (err) {
                        if (!err.message.includes('Cannot find module')) {
                            log(`Error resolving ${localPath}:`, colors.red);
                            log(err.message, colors.red);
                        }
                    }
                }
            },
            // Also check for webpack provided modules usage
            Identifier(nodePath) {
                const name = nodePath.node.name;
                if (providedModules[name] && typeof providedModules[name] === 'string') {
                    requires.add(providedModules[name]);
                }
            }
        });
    } catch (err) {
        if (!err.message.includes('Cannot find module')) {
            log(`Error parsing ${filePath}:`, colors.red);
            log(err.message, colors.red);
        }
    }

    return { requires, rawFiles };
}

// Check if a bundled file contains the required modules and raw files
function checkBundle(bundleContent, requiredModules, rawFiles) {
    const results = {};
    
    // Check for module dependencies
    for (const mod of requiredModules) {
        // Check for various webpack patterns
        const patterns = [
            `require\\s*\\(\\s*["']${mod}["']\\s*\\)`,  // require('module')
            `__webpack_require__\\s*\\(\\s*["'].*${mod}["']\\s*\\)`, // __webpack_require__('module')
            `from\\s+["']${mod}["']`, // from 'module'
            `require\\s*\\(\\s*["']${mod}/`, // require('module/something')
            `__webpack_require__\\s*\\(\\s*["'].*${mod}/`, // __webpack_require__('module/something')
            `["']${mod}["']:\\s*require\\(`, // 'module': require(
            `["']${mod}["']:\\s*__webpack_require__\\(`, // 'module': __webpack_require__(
            `["']\\.\\/node_modules\\/${mod}\\/`, // './node_modules/module/'
            `["']\\.\\/${mod}\\/`, // './module/'
            // Additional patterns for webpack provided modules
            `__webpack_require__\\s*\\(\\s*["']${mod}["']\\s*\\)`, // Direct webpack require
            `__webpack_require__\\s*\\(\\s*[0-9]+\\s*\\).*${mod}`, // Numeric webpack require
            `__webpack_require__\\s*\\(\\s*"\\./node_modules/${mod}/`, // Node modules path
            `__webpack_require__\\s*\\(\\s*"\\.\\./node_modules/${mod}/` // Parent node modules path
        ];
        
        const found = patterns.some(pattern => 
            new RegExp(pattern).test(bundleContent)
        );
        
        results[mod] = found;
    }

    // Check for raw files
    for (const rawFile of rawFiles) {
        try {
            const rawContent = fs.readFileSync(rawFile, 'utf8');
            // For raw files, webpack might:
            // 1. Include them as raw strings
            const rawFound = bundleContent.includes(JSON.stringify(rawContent));
            // 2. Include them as base64
            const base64Content = Buffer.from(rawContent).toString('base64');
            const base64Found = bundleContent.includes(base64Content);
            // 3. Include them with escaped newlines
            const escapedContent = rawContent.replace(/\n/g, '\\n');
            const escapedFound = bundleContent.includes(escapedContent);
            
            results[`[Raw File] ${path.basename(rawFile)}`] = rawFound || base64Found || escapedFound;
        } catch (err) {
            log(`Error reading raw file ${rawFile}:`, colors.red);
            log(err.message, colors.red);
        }
    }
    
    return results;
}

// Main check function
async function checkLambdaDeps() {
    log('\nChecking Lambda dependencies...', colors.yellow);

    // Get all .js files from source directory
    const sourceFiles = fs.readdirSync(LAMBDA_SRC_DIR)
        .filter(f => f.endsWith('.js') && f !== 'version.js');

    let totalMissing = 0;

    for (const sourceFile of sourceFiles) {
        log(`\nAnalyzing ${sourceFile}...`, colors.yellow);

        const sourcePath = path.join(LAMBDA_SRC_DIR, sourceFile);
        const bundlePath = path.join(LAMBDA_DIST_DIR, 
            sourceFile.replace(/-/g, '')); // Handle hyphenated names

        // Find all requires including those from imported files
        requireCache.clear(); // Clear cache for each main file
        const { requires, rawFiles } = findAllRequires(sourcePath);

        log(`Found ${requires.size} dependencies:`, colors.yellow);
        Array.from(requires).sort().forEach(r => log(`  ${r}`));

        if (rawFiles.size > 0) {
            log(`Found ${rawFiles.size} raw files:`, colors.yellow);
            Array.from(rawFiles).sort().forEach(r => log(`  ${path.basename(r)}`));
        }

        // Check bundle
        if (fs.existsSync(bundlePath)) {
            const bundleContent = fs.readFileSync(bundlePath, 'utf8');
            const bundleSize = (fs.statSync(bundlePath).size / 1024 / 1024).toFixed(2);
            log(`\nChecking bundle (${bundleSize}MB)...`, colors.yellow);

            const results = checkBundle(bundleContent, requires, rawFiles);
            
            for (const [mod, found] of Object.entries(results)) {
                const color = found ? colors.green : colors.red;
                const symbol = found ? '✓' : '✗';
                log(`  ${symbol} ${mod}`, color);
            }

            const missing = Object.entries(results)
                .filter(([, found]) => !found)
                .map(([mod]) => mod);

            if (missing.length > 0) {
                log('\nMissing dependencies:', colors.red);
                missing.forEach(mod => log(`  ${mod}`, colors.red));
                totalMissing += missing.length;
            }
        } else {
            log(`Bundle not found: ${bundlePath}`, colors.red);
            totalMissing++;
        }
    }

    // Final summary
    if (totalMissing > 0) {
        log(`\nFound ${totalMissing} total missing dependencies!`, colors.red);
        process.exit(1);
    } else {
        log('\nAll dependencies found!', colors.green);
        process.exit(0);
    }
}

// Run the check
checkLambdaDeps().catch(err => {
    console.error(err);
    process.exit(1);
});
