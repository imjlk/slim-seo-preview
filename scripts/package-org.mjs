import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath( import.meta.url );
const repoRoot = resolve( dirname( currentFile ), '..' );
const artifactsDir = resolve( repoRoot, 'artifacts' );
const stageRoot = resolve( artifactsDir, 'submission' );
const pluginDirName = 'slim-seo-preview';
const stagePluginDir = resolve( stageRoot, pluginDirName );
const zipPath = resolve( artifactsDir, 'slim-seo-preview-org.zip' );

const includedPaths = [
	'readme.txt',
	'slim-seo-preview.php',
	'build',
	'src',
	'languages',
];

function ensureDirectory( path ) {
	mkdirSync( path, { recursive: true } );
}

function resetPath( path ) {
	rmSync( path, { force: true, recursive: true } );
}

function copyPath( relativePath ) {
	const sourcePath = resolve( repoRoot, relativePath );
	const destinationPath = resolve( stagePluginDir, relativePath );

	if ( ! existsSync( sourcePath ) ) {
		throw new Error( `Missing required submission path: ${ relativePath }` );
	}

	cpSync( sourcePath, destinationPath, { recursive: true } );
}

function createZip() {
	const zipName = 'slim-seo-preview-org.zip';

	if ( existsSync( zipPath ) ) {
		rmSync( zipPath, { force: true } );
	}

	execFileSync( 'zip', [ '-rq', zipName, pluginDirName ], {
		cwd: stageRoot,
		stdio: 'inherit',
	} );

	cpSync( resolve( stageRoot, zipName ), zipPath );
}

resetPath( stageRoot );
ensureDirectory( stagePluginDir );
ensureDirectory( artifactsDir );

for ( const relativePath of includedPaths ) {
	copyPath( relativePath );
}

createZip();

console.log( `Created WordPress.org submission package: ${ zipPath }` );
