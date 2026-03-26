import { existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath( import.meta.url );
const repoRoot = resolve( dirname( currentFile ), '..' );
const languagesDir = resolve( repoRoot, 'languages' );
const potPath = resolve( languagesDir, 'slim-seo-preview.pot' );
const slug = 'slim-seo-preview';
const jsonMapArg = '--use-map={"src/index.js":"build/index.js"}';
const action = process.argv[ 2 ] || 'build';

function run( command, args, cwd = repoRoot ) {
	execFileSync( command, args, {
		cwd,
		stdio: 'inherit',
	} );
}

function assertPath( path, label ) {
	if ( existsSync( path ) ) {
		return;
	}

	throw new Error( `Missing required ${ label }: ${ path }` );
}

function getPoFiles() {
	return readdirSync( languagesDir )
		.filter(
			( file ) =>
				file.startsWith( `${ slug }-` ) &&
				file.endsWith( '.po' ) &&
				! file.endsWith( '.pot' )
		)
		.map( ( file ) => resolve( languagesDir, file ) );
}

function removeBackupFile( poPath ) {
	const backupPath = `${ poPath }~`;
	if ( existsSync( backupPath ) ) {
		rmSync( backupPath, { force: true } );
	}
}

function removeLocaleJsonFiles( locale ) {
	for ( const file of readdirSync( languagesDir ) ) {
		if ( file.startsWith( `${ slug }-${ locale }-` ) && file.endsWith( '.json' ) ) {
			rmSync( resolve( languagesDir, file ), { force: true } );
		}
	}
}

function getLocaleFromPoPath( poPath ) {
	const fileName = poPath.split( '/' ).pop() ?? '';
	return fileName
		.replace( `${ slug }-`, '' )
		.replace( '.po', '' );
}

function buildPot() {
	run( 'wp', [
		'i18n',
		'make-pot',
		'.',
		potPath,
		`--slug=${ slug }`,
		`--domain=${ slug }`,
		'--exclude=.git,.github,node_modules,vendor,artifacts,.wp-env,build',
	] );
}

function compileLocale( poPath ) {
	const locale = getLocaleFromPoPath( poPath );
	const moPath = poPath.replace( /\.po$/, '.mo' );

	run( 'msgmerge', [ '--update', '--no-fuzzy-matching', poPath, potPath ] );
	removeBackupFile( poPath );
	run( 'msgfmt', [ poPath, '-o', moPath ] );

	removeLocaleJsonFiles( locale );
	run( 'wp', [
		'i18n',
		'make-json',
		poPath,
		languagesDir,
		'--no-purge',
		'--pretty-print',
		jsonMapArg,
	] );
}

function buildTranslations() {
	assertPath( languagesDir, 'languages directory' );
	buildPot();

	const poFiles = getPoFiles();
	for ( const poPath of poFiles ) {
		compileLocale( poPath );
	}
}

switch ( action ) {
	case 'pot':
		buildPot();
		break;

	case 'build':
		buildTranslations();
		break;

	default:
		console.error( 'Usage: npm run i18n:pot | npm run i18n:build' );
		process.exit( 1 );
}
