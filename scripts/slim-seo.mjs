import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const currentFile = fileURLToPath( import.meta.url );
const repoRoot = resolve( dirname( currentFile ), '..' );
const siblingSlimSeo = resolve( repoRoot, '../slim-seo' );
const upstream = 'https://github.com/elightup/slim-seo.git';
const vendorAutoload = resolve( siblingSlimSeo, 'vendor/autoload.php' );
const siblingNodeModules = resolve( siblingSlimSeo, 'node_modules' );
const siblingCssBuild = resolve( siblingSlimSeo, 'css/meta-tags.css' );
const siblingJsBuild = resolve( siblingSlimSeo, 'js/build/single.js' );

const action = process.argv[ 2 ];
const arg = process.argv[ 3 ];

function run( command, args, cwd = repoRoot ) {
	execFileSync( command, args, {
		cwd,
		stdio: 'inherit',
	} );
}

function canResolveAjvCodegen() {
	try {
		execFileSync(
			'node',
			[
				'-e',
				"require('ajv/dist/compile/codegen')",
			],
			{
				cwd: siblingSlimSeo,
				stdio: 'ignore',
			}
		);
		return true;
	} catch {
		return false;
	}
}

function ensureClone() {
	if ( existsSync( resolve( siblingSlimSeo, '.git' ) ) ) {
		return;
	}

	run( 'git', [ 'clone', upstream, siblingSlimSeo ] );
}

function ensureComposerDependencies() {
	ensureClone();

	if ( existsSync( vendorAutoload ) ) {
		return;
	}

	run( 'composer', [ 'install', '--no-interaction', '--prefer-dist' ], siblingSlimSeo );
}

function ensureFrontendAssets() {
	ensureClone();

	const hasCssBuild = existsSync( siblingCssBuild );
	const hasJsBuild = existsSync( siblingJsBuild );
	if ( hasCssBuild && hasJsBuild ) {
		return;
	}

	if ( ! existsSync( siblingNodeModules ) ) {
		run( 'npm', [ 'install', '--legacy-peer-deps' ], siblingSlimSeo );
	}

	if ( ! canResolveAjvCodegen() ) {
		run( 'npm', [ 'install', '--legacy-peer-deps', '--no-save', 'ajv@^8', 'ajv-keywords@^5' ], siblingSlimSeo );
	}

	run( 'npm', [ 'run', 'build' ], siblingSlimSeo );
}

switch ( action ) {
	case 'clone':
		ensureClone();
		break;

	case 'prepare':
		ensureComposerDependencies();
		ensureFrontendAssets();
		break;

	case 'tag':
		if ( ! arg ) {
			console.error( 'Usage: npm run slim-seo:use:tag -- <tag>' );
			process.exit( 1 );
		}
		ensureClone();
		run( 'git', [ 'fetch', '--tags', 'origin' ], siblingSlimSeo );
		run( 'git', [ 'checkout', arg ], siblingSlimSeo );
		ensureComposerDependencies();
		ensureFrontendAssets();
		break;

	case 'master':
		ensureClone();
		run( 'git', [ 'fetch', 'origin', 'master' ], siblingSlimSeo );
		run( 'git', [ 'switch', 'master' ], siblingSlimSeo );
		run( 'git', [ 'pull', '--ff-only', 'origin', 'master' ], siblingSlimSeo );
		ensureComposerDependencies();
		ensureFrontendAssets();
		break;

	default:
		console.error( 'Usage: npm run slim-seo:clone | slim-seo:prepare | slim-seo:use:tag -- <tag> | slim-seo:use:master' );
		process.exit( 1 );
}
