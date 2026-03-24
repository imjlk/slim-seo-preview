import apiFetch from '@wordpress/api-fetch';
import { useEntityProp } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';
import { PluginSidebar } from '@wordpress/editor';
import { registerPlugin } from '@wordpress/plugins';
import { __ } from '@wordpress/i18n';
import {
	Button,
	Modal,
	Notice,
	PanelBody,
	Spinner,
	TabPanel,
	ToggleControl,
} from '@wordpress/components';
import { useEffect, useRef, useState } from '@wordpress/element';
import './style.scss';

const config = window.SlimSeoPreview || {};
const METABOX_SYNC_INTERVAL_MS = 500;

const createEmptyMetaboxState = () => ( {
	present: false,
	values: {
		title: undefined,
		description: undefined,
		canonical: undefined,
		facebookImage: undefined,
		twitterImage: undefined,
		noindex: undefined,
	},
} );

const request = ( route, data = {} ) =>
	apiFetch( {
		path: `/slim-seo/${ route }`,
		method: 'POST',
		data,
	} );

const normalizeUrl = ( value ) => {
	if ( ! value || value.includes( '{{' ) ) {
		return '';
	}

	try {
		return new URL( value, window.location.origin ).toString();
	} catch {
		return '';
	}
};

const getUrlParts = ( value ) => {
	const normalized = normalizeUrl( value );
	if ( ! normalized ) {
		return {
			href: '',
			host: '',
			path: '',
			label: '',
		};
	}

	const parsed = new URL( normalized );
	return {
		href: parsed.toString(),
		host: parsed.host,
		path: `${ parsed.pathname }${ parsed.search }`.replace( /\/$/, '' ) || '/',
		label: parsed.toString().replace( /^https?:\/\//, '' ),
	};
};

const clipText = ( value, limit ) => {
	if ( ! value ) {
		return '';
	}

	if ( value.length <= limit ) {
		return value;
	}

	return `${ value.slice( 0, Math.max( limit - 1, 0 ) ).trimEnd() }\u2026`;
};

const formatTimestamp = ( value ) => {
	if ( ! value ) {
		return '—';
	}

	try {
		return new Intl.DateTimeFormat( undefined, {
			dateStyle: 'medium',
			timeStyle: 'short',
		} ).format( new Date( value ) );
	} catch {
		return value;
	}
};

const getMetaboxFieldValue = ( root, selector ) => {
	const field = root?.querySelector( selector );
	return field && typeof field.value === 'string' ? field.value : undefined;
};

const getMetaboxCheckboxValue = ( root, selector ) => {
	const field = root?.querySelector( selector );
	return field && typeof field.checked === 'boolean' ? field.checked : undefined;
};

const readMetaboxState = () => {
	const fallback = createEmptyMetaboxState();
	if ( typeof document === 'undefined' || ! config.metaboxId ) {
		return fallback;
	}

	const metabox = document.getElementById( config.metaboxId );
	if ( ! metabox ) {
		return fallback;
	}

	return {
		present: true,
		values: {
			title: getMetaboxFieldValue( metabox, 'input[name="slim_seo[title]"]' ),
			description: getMetaboxFieldValue(
				metabox,
				'textarea[name="slim_seo[description]"]'
			),
			canonical: getMetaboxFieldValue(
				metabox,
				'input[name="slim_seo[canonical]"]'
			),
			facebookImage: getMetaboxFieldValue(
				metabox,
				'input[name="slim_seo[facebook_image]"]'
			),
			twitterImage: getMetaboxFieldValue(
				metabox,
				'input[name="slim_seo[twitter_image]"]'
			),
			noindex: getMetaboxCheckboxValue(
				metabox,
				'input[name="slim_seo[noindex]"]'
			),
		},
	};
};

const areMetaboxStatesEqual = ( current, next ) =>
	current.present === next.present &&
	current.values.title === next.values.title &&
	current.values.description === next.values.description &&
	current.values.canonical === next.values.canonical &&
	current.values.facebookImage === next.values.facebookImage &&
	current.values.twitterImage === next.values.twitterImage &&
	current.values.noindex === next.values.noindex;

const syncMetaboxNoindexField = ( nextValue ) => {
	if ( typeof document === 'undefined' || ! config.metaboxId ) {
		return;
	}

	const metabox = document.getElementById( config.metaboxId );
	const checkbox = metabox?.querySelector( 'input[name="slim_seo[noindex]"]' );
	if ( ! checkbox || typeof checkbox.checked !== 'boolean' ) {
		return;
	}

	if ( checkbox.checked === nextValue ) {
		return;
	}

	checkbox.checked = nextValue;
	checkbox.dispatchEvent( new Event( 'change', { bubbles: true } ) );
};

const SummaryRow = ( { label, value } ) => (
	<div className="ssp-summary-row">
		<div className="ssp-summary-row__label">{ label }</div>
		<div className="ssp-summary-row__value">{ value || '—' }</div>
	</div>
);

const SearchResultCard = ( {
	title,
	description,
	urlParts,
	siteName,
	mobile = false,
} ) => {
	const siteLabel = urlParts.host || siteName || __( 'Preview', 'slim-seo-preview' );
	const urlLabel =
		urlParts.label || __( 'URL preview unavailable', 'slim-seo-preview' );

	return (
		<div className={ `ssp-serp-card${ mobile ? ' ssp-serp-card--mobile' : '' }` }>
			<div className="ssp-serp-card__site">
				<div className="ssp-serp-card__favicon" aria-hidden="true">
					{ siteLabel.charAt( 0 ).toUpperCase() }
				</div>
				<div className="ssp-serp-card__site-meta">
					<div className="ssp-serp-card__site-name">
						{ clipText( siteLabel, mobile ? 20 : 40 ) }
					</div>
					<div className="ssp-serp-card__url">
						{ clipText( urlLabel, mobile ? 30 : 64 ) }
					</div>
				</div>
			</div>
			<div className="ssp-serp-card__title">
				{ title || __( 'SEO title preview will appear here.', 'slim-seo-preview' ) }
			</div>
			<div className="ssp-serp-card__description">
				{ description || __( 'Meta description preview will appear here.', 'slim-seo-preview' ) }
			</div>
		</div>
	);
};

const SearchTabs = ( { mobile = false } ) => (
	<div className={ `ssp-search-tabs${ mobile ? ' ssp-search-tabs--mobile' : '' }` }>
		<span className="ssp-search-tabs__item ssp-search-tabs__item--active">
			{ __( 'All', 'slim-seo-preview' ) }
		</span>
		<span className="ssp-search-tabs__item">{ __( 'Images', 'slim-seo-preview' ) }</span>
		<span className="ssp-search-tabs__item">{ __( 'News', 'slim-seo-preview' ) }</span>
		{ ! mobile && (
			<span className="ssp-search-tabs__item">{ __( 'Videos', 'slim-seo-preview' ) }</span>
		) }
	</div>
);

const DesktopSerpShell = ( {
	title,
	description,
	urlParts,
	siteName,
	searchQuery,
} ) => (
	<div className="ssp-desktop-shell">
		<div className="ssp-desktop-shell__chrome">
			<div className="ssp-desktop-shell__dots" aria-hidden="true">
				<span />
				<span />
				<span />
			</div>
			<div className="ssp-desktop-shell__address">
				{ clipText(
					urlParts.host || siteName || __( 'Search preview', 'slim-seo-preview' ),
					38
				) }
			</div>
			<div className="ssp-desktop-shell__avatar" aria-hidden="true" />
		</div>

		<div className="ssp-desktop-shell__body">
			<div className="ssp-search-header">
				<div className="ssp-search-header__brand">
					{ __( 'Search', 'slim-seo-preview' ) }
				</div>
				<div className="ssp-search-header__field">
					<span className="ssp-search-header__icon" aria-hidden="true">
						⌕
					</span>
					<span>{ clipText( searchQuery, 48 ) }</span>
				</div>
			</div>

			<SearchTabs />

			<div className="ssp-search-stats">
				{ __( 'Previewing how this result could appear on a desktop search page.', 'slim-seo-preview' ) }
			</div>

			<SearchResultCard
				title={ title }
				description={ description }
				urlParts={ urlParts }
				siteName={ siteName }
			/>
		</div>
	</div>
);

const MobileSerpShell = ( {
	title,
	description,
	urlParts,
	siteName,
	searchQuery,
} ) => (
	<div className="ssp-mobile-shell">
		<div className="ssp-mobile-shell__device">
			<div className="ssp-mobile-shell__notch" aria-hidden="true" />
			<div className="ssp-mobile-shell__screen">
				<div className="ssp-mobile-shell__status">
					<span>9:41</span>
					<span>5G</span>
				</div>

				<div className="ssp-mobile-shell__topbar">
					<div className="ssp-mobile-shell__engine">
						{ __( 'Search', 'slim-seo-preview' ) }
					</div>
					<div className="ssp-mobile-shell__field">
						<span className="ssp-mobile-shell__icon" aria-hidden="true">
							⌕
						</span>
						<span>{ clipText( searchQuery, 24 ) }</span>
					</div>
				</div>

				<SearchTabs mobile />

				<div className="ssp-mobile-shell__result">
					<SearchResultCard
						title={ title }
						description={ description }
						urlParts={ urlParts }
						siteName={ siteName }
						mobile
					/>
				</div>
			</div>
		</div>
	</div>
);

const SearchResultPreview = ( { title, description, urlParts, noindex, onOpenModal } ) => (
	<PanelBody
		title={ __( 'SERP Preview', 'slim-seo-preview' ) }
		initialOpen
		className="ssp-panel-body"
	>
		<div className="ssp-summary-card">
			{ noindex && (
				<div className="ssp-inline-meta">
					<span className="ssp-badge">{ __( 'Noindex', 'slim-seo-preview' ) }</span>
				</div>
			) }
			<SummaryRow
				label={ __( 'Title', 'slim-seo-preview' ) }
				value={ title }
			/>
			<SummaryRow
				label={ __( 'Description', 'slim-seo-preview' ) }
				value={ description }
			/>
			<SummaryRow
				label={ __( 'Canonical', 'slim-seo-preview' ) }
				value={ urlParts.label || __( 'URL preview unavailable', 'slim-seo-preview' ) }
			/>
			<Button variant="secondary" onClick={ onOpenModal }>
				{ __( 'Open SERP preview', 'slim-seo-preview' ) }
			</Button>
		</div>
	</PanelBody>
);

const SocialPreview = ( { title, description, urlParts, imageUrl } ) => (
	<PanelBody
		title={ __( 'Open Graph Preview', 'slim-seo-preview' ) }
		initialOpen
		className="ssp-panel-body"
	>
		<div className="ssp-social-card">
			{ imageUrl ? (
				<img className="ssp-social-card__image" src={ imageUrl } alt="" />
			) : (
				<div className="ssp-social-card__image ssp-social-card__image--placeholder">
					<span>{ config.siteName || __( 'Preview', 'slim-seo-preview' ) }</span>
				</div>
			) }
			<div className="ssp-social-card__body">
				<div className="ssp-social-card__domain">{ urlParts.host || config.siteName || __( 'Open Graph', 'slim-seo-preview' ) }</div>
				<div className="ssp-social-card__title">{ title || __( 'OG title preview will appear here.', 'slim-seo-preview' ) }</div>
				<div className="ssp-social-card__description">{ description || __( 'OG description preview will appear here.', 'slim-seo-preview' ) }</div>
			</div>
		</div>
	</PanelBody>
);

const SchemaPreviewSection = ( {
	schemaState,
	sourceUrl,
	onRefresh,
	onOpenModal,
} ) => (
	<PanelBody
		title={ __( 'Applied Schema', 'slim-seo-preview' ) }
		initialOpen
		className="ssp-panel-body"
	>
		<div className="ssp-summary-card">
			{ schemaState?.data?.scriptCount > 0 && (
				<div className="ssp-inline-meta">
					<span className="ssp-badge ssp-badge--neutral">
						{ `${ schemaState.data.scriptCount } JSON-LD` }
					</span>
				</div>
			) }
			<SummaryRow
				label={ __( 'Source URL', 'slim-seo-preview' ) }
				value={ sourceUrl || __( 'URL preview unavailable', 'slim-seo-preview' ) }
			/>
			<SummaryRow
				label={ __( 'Scripts found', 'slim-seo-preview' ) }
				value={
					schemaState.loading
						? __( 'Loading…', 'slim-seo-preview' )
						: String( schemaState?.data?.scriptCount || 0 )
				}
			/>
			<SummaryRow
				label={ __( 'Entities found', 'slim-seo-preview' ) }
				value={
					schemaState.loading
						? __( 'Loading…', 'slim-seo-preview' )
						: String( schemaState?.data?.entityCount || 0 )
				}
			/>
			<SummaryRow
				label={ __( 'Last fetched', 'slim-seo-preview' ) }
				value={ formatTimestamp( schemaState?.data?.fetchedAt ) }
			/>

			<p className="ssp-note">
				{ __( 'Reads the saved frontend JSON-LD currently rendered on the page. Unsaved editor changes are not included.', 'slim-seo-preview' ) }
			</p>

			{ schemaState.error && (
				<Notice status="error" isDismissible={ false }>
					{ schemaState.error }
				</Notice>
			) }

			{ ! schemaState.loading && ! schemaState.error && schemaState?.data?.scriptCount === 0 && (
				<Notice status="info" isDismissible={ false }>
					{ __( 'No JSON-LD schema was found on the rendered page.', 'slim-seo-preview' ) }
				</Notice>
			) }

			<div className="ssp-button-row">
				<Button
					variant="secondary"
					onClick={ onRefresh }
					disabled={ schemaState.loading || schemaState.refreshing }
				>
					{ schemaState.refreshing
						? __( 'Refreshing…', 'slim-seo-preview' )
						: __( 'Refresh applied schema', 'slim-seo-preview' ) }
				</Button>
				<Button
					variant="primary"
					onClick={ onOpenModal }
					disabled={ ! schemaState.data && ( schemaState.loading || !! schemaState.error ) }
				>
					{ __( 'Open schema preview', 'slim-seo-preview' ) }
				</Button>
			</div>
		</div>
	</PanelBody>
);

const SchemaScriptCard = ( { script } ) => (
	<article className="ssp-schema-script">
		<div className="ssp-schema-script__header">
			<div>
				<div className="ssp-schema-script__title">{ script.label }</div>
				<div className="ssp-schema-script__meta">
					{ script.isValid
						? `${ script.entityCount } ${ __( 'entities', 'slim-seo-preview' ) }`
						: __( 'Invalid JSON-LD', 'slim-seo-preview' ) }
				</div>
			</div>
			{ script.isSlimSeo && (
				<span className="ssp-badge ssp-badge--neutral">
					{ __( 'Slim SEO graph', 'slim-seo-preview' ) }
				</span>
			) }
		</div>

		<div className="ssp-schema-script__chips">
			{ script.id && (
				<span className="ssp-schema-chip">
					{ `#${ script.id }` }
				</span>
			) }
			{ script.types?.map( ( type ) => (
				<span key={ type } className="ssp-schema-chip">
					{ type }
				</span>
			) ) }
		</div>

		<pre className="ssp-schema-script__code">
			<code>{ script.prettyJson || script.rawJson }</code>
		</pre>
	</article>
);

const SerpPreviewModal = ( {
	title,
	description,
	urlParts,
	siteName,
	searchQuery,
	onRequestClose,
} ) => (
	<Modal
		title={ __( 'SERP Preview', 'slim-seo-preview' ) }
		onRequestClose={ onRequestClose }
		className="ssp-serp-modal"
	>
		<div className="ssp-modal-stack ssp-ui">
			<div className="ssp-modal-stack__intro">
				<p>
					{ __(
						'Compare how the saved page may appear in desktop and mobile search results.',
						'slim-seo-preview'
					) }
				</p>
			</div>

			<PanelBody
				title={ __( 'Device Preview', 'slim-seo-preview' ) }
				initialOpen
				className="ssp-modal-panel-body"
			>
				<TabPanel
					className="ssp-tab-panel"
					activeClass="is-active"
					tabs={ [
						{
							name: 'desktop',
							title: __( 'Desktop', 'slim-seo-preview' ),
							className: 'ssp-tab',
						},
						{
							name: 'mobile',
							title: __( 'Mobile', 'slim-seo-preview' ),
							className: 'ssp-tab',
						},
					] }
				>
					{ ( tab ) => (
						<div className="ssp-tab-panel__view">
							{ tab.name === 'desktop' ? (
								<DesktopSerpShell
									title={ title }
									description={ description }
									urlParts={ urlParts }
									siteName={ siteName }
									searchQuery={ searchQuery }
								/>
							) : (
								<MobileSerpShell
									title={ title }
									description={ description }
									urlParts={ urlParts }
									siteName={ siteName }
									searchQuery={ searchQuery }
								/>
							) }
						</div>
					) }
				</TabPanel>
			</PanelBody>

			<PanelBody
				title={ __( 'Source', 'slim-seo-preview' ) }
				initialOpen={ false }
				className="ssp-modal-panel-body"
			>
				<div className="ssp-summary-card">
					<SummaryRow
						label={ __( 'Title', 'slim-seo-preview' ) }
						value={ title }
					/>
					<SummaryRow
						label={ __( 'Description', 'slim-seo-preview' ) }
						value={ description }
					/>
					<SummaryRow
						label={ __( 'Canonical', 'slim-seo-preview' ) }
						value={ urlParts.label || __( 'URL preview unavailable', 'slim-seo-preview' ) }
					/>
				</div>
			</PanelBody>
		</div>
	</Modal>
);

const SchemaPreviewModal = ( {
	schemaState,
	schemaSourceUrl,
	onRefresh,
	onRequestClose,
} ) => (
	<Modal
		title={ __( 'Applied Schema Preview', 'slim-seo-preview' ) }
		onRequestClose={ onRequestClose }
		className="ssp-schema-modal"
	>
		<div className="ssp-modal-stack ssp-ui">
			<div className="ssp-modal-stack__intro">
				<p>
					{ __(
						'This reads the saved frontend JSON-LD currently rendered on the page, after Slim SEO hooks and filters run.',
						'slim-seo-preview'
					) }
				</p>
			</div>

			<PanelBody
				title={ __( 'Overview', 'slim-seo-preview' ) }
				initialOpen
				className="ssp-modal-panel-body"
			>
				<div className="ssp-summary-card">
					<SummaryRow
						label={ __( 'Source URL', 'slim-seo-preview' ) }
						value={ schemaSourceUrl || __( 'URL preview unavailable', 'slim-seo-preview' ) }
					/>
					<SummaryRow
						label={ __( 'Scripts', 'slim-seo-preview' ) }
						value={ String( schemaState?.data?.scriptCount || 0 ) }
					/>
					<SummaryRow
						label={ __( 'Entities', 'slim-seo-preview' ) }
						value={ String( schemaState?.data?.entityCount || 0 ) }
					/>
					<SummaryRow
						label={ __( 'Fetched', 'slim-seo-preview' ) }
						value={ formatTimestamp( schemaState?.data?.fetchedAt ) }
					/>
				</div>

				<div className="ssp-button-row ssp-button-row--modal">
					<Button
						variant="secondary"
						onClick={ onRefresh }
						disabled={ schemaState.loading || schemaState.refreshing }
					>
						{ schemaState.refreshing
							? __( 'Refreshing…', 'slim-seo-preview' )
							: __( 'Refresh applied schema', 'slim-seo-preview' ) }
					</Button>
				</div>
			</PanelBody>

			<PanelBody
				title={ __( 'Rendered Scripts', 'slim-seo-preview' ) }
				initialOpen
				className="ssp-modal-panel-body"
			>
				{ schemaState.loading && (
					<div className="ssp-loading">
						<Spinner />
					</div>
				) }

				{ schemaState.error && (
					<Notice status="error" isDismissible={ false }>
						{ schemaState.error }
					</Notice>
				) }

				{ ! schemaState.loading && ! schemaState.error && schemaState?.data?.scriptCount === 0 && (
					<Notice status="info" isDismissible={ false }>
						{ __( 'No JSON-LD schema was found on the rendered page.', 'slim-seo-preview' ) }
					</Notice>
				) }

				{ ! schemaState.loading && ! schemaState.error && schemaState?.data?.scriptCount > 0 && (
					<div className="ssp-schema-list">
						{ schemaState.data.scripts.map( ( script ) => (
							<SchemaScriptCard
								key={ `${ script.index }-${ script.id || 'jsonld' }` }
								script={ script }
							/>
						) ) }
					</div>
				) }
			</PanelBody>
		</div>
	</Modal>
);

function App() {
	const {
		postId,
		postType,
		postTitle,
		postContent,
		postExcerpt,
		permalink,
		featuredImageUrl,
	} = useSelect( ( select ) => {
		const editor = select( 'core/editor' );
		const mediaId = editor?.getEditedPostAttribute?.( 'featured_media' ) || 0;
		const media = mediaId ? select( 'core' )?.getMedia?.( mediaId ) : null;

		return {
			postId: editor?.getCurrentPostId?.() || 0,
			postType: editor?.getCurrentPostType?.() || config.postType || '',
			postTitle: editor?.getEditedPostAttribute?.( 'title' ) || '',
			postContent: editor?.getEditedPostContent?.() || '',
			postExcerpt: editor?.getEditedPostAttribute?.( 'excerpt' ) || '',
			permalink: editor?.getPermalink?.() || '',
			featuredImageUrl: media?.source_url || media?.media_details?.sizes?.full?.source_url || '',
		};
	}, [] );

	const [ meta ] = useEntityProp( 'postType', postType || config.postType || 'post', 'meta' );
	const [ metaboxState, setMetaboxState ] = useState( () => readMetaboxState() );
	const [ preview, setPreview ] = useState( {
		title: '',
		description: '',
	} );
	const [ previewError, setPreviewError ] = useState( '' );
	const [ previewLoading, setPreviewLoading ] = useState( true );
	const [ schemaState, setSchemaState ] = useState( {
		loading: !! config.slimSeoActive,
		refreshing: false,
		error: '',
		data: null,
	} );
	const [ noindexState, setNoindexState ] = useState( {
		postNoindex: false,
		postTypeNoindex: false,
		effectiveNoindex: false,
		loading: !! config.slimSeoActive,
		error: '',
	} );
	const [ toggleError, setToggleError ] = useState( '' );
	const [ isToggling, setIsToggling ] = useState( false );
	const [ isSerpModalOpen, setIsSerpModalOpen ] = useState( false );
	const [ isSchemaModalOpen, setIsSchemaModalOpen ] = useState( false );
	const previewRequestIdRef = useRef( 0 );
	const schemaRequestIdRef = useRef( 0 );
	const toggleRequestIdRef = useRef( 0 );

	const slimSeoMeta = meta?.slim_seo || {};
	const liveSlimSeoMeta = {
		title: metaboxState.values.title ?? slimSeoMeta?.title ?? '',
		description: metaboxState.values.description ?? slimSeoMeta?.description ?? '',
		canonical: metaboxState.values.canonical ?? slimSeoMeta?.canonical ?? '',
		facebook_image:
			metaboxState.values.facebookImage ?? slimSeoMeta?.facebook_image ?? '',
		twitter_image:
			metaboxState.values.twitterImage ?? slimSeoMeta?.twitter_image ?? '',
		noindex: metaboxState.values.noindex ?? slimSeoMeta?.noindex ?? false,
	};
	const hasMetabox = metaboxState.present;
	const supportsQuickEdit = !! config.canEditPosts;
	const previewBlockedReason = ! config.slimSeoActive
		? config.strings?.dependencyNotice
		: '';
	const toggleBlockedReason =
		! config.slimSeoActive ? config.strings?.dependencyNotice :
			! config.canEditPosts ? config.strings?.readOnlyPermission :
			'';

	useEffect( () => {
		if ( typeof document === 'undefined' || ! document.body ) {
			return undefined;
		}

		let metabox = null;
		const syncState = () => {
			setMetaboxState( ( current ) => {
				const next = readMetaboxState();
				return areMetaboxStatesEqual( current, next ) ? current : next;
			} );
		};

		const removeListeners = () => {
			if ( ! metabox ) {
				return;
			}

			metabox.removeEventListener( 'input', syncState, true );
			metabox.removeEventListener( 'change', syncState, true );
		};

		const attachListeners = () => {
			const nextMetabox = config.metaboxId
				? document.getElementById( config.metaboxId )
				: null;

			if ( nextMetabox === metabox ) {
				return;
			}

			removeListeners();
			metabox = nextMetabox;

			if ( ! metabox ) {
				return;
			}

			metabox.addEventListener( 'input', syncState, true );
			metabox.addEventListener( 'change', syncState, true );
		};

		attachListeners();
		syncState();

		const observer = new MutationObserver( () => {
			attachListeners();
			syncState();
		} );
		observer.observe( document.body, {
			childList: true,
			subtree: true,
		} );

		const intervalId = window.setInterval( () => {
			syncState();
		}, METABOX_SYNC_INTERVAL_MS );

		return () => {
			window.clearInterval( intervalId );
			observer.disconnect();
			removeListeners();
		};
	}, [] );

	useEffect( () => {
		if ( previewBlockedReason || ! postId ) {
			setNoindexState( ( current ) => ( {
				...current,
				loading: false,
				error: '',
			} ) );
			return;
		}

		let isMounted = true;

		apiFetch( {
			path: `/slim-seo-preview/v1/post/${ postId }/noindex`,
		} )
			.then( ( response ) => {
				if ( ! isMounted ) {
					return;
				}
				setNoindexState( {
					postNoindex: !! response?.postNoindex,
					postTypeNoindex: !! response?.postTypeNoindex,
					effectiveNoindex: !! response?.effectiveNoindex,
					loading: false,
					error: '',
				} );
			} )
			.catch( () => {
				if ( ! isMounted ) {
					return;
				}
				setNoindexState( {
					postNoindex: false,
					postTypeNoindex: false,
					effectiveNoindex: false,
					loading: false,
					error: config.strings?.restError || __( 'Slim SEO Preview could not load Slim SEO data.', 'slim-seo-preview' ),
				} );
			} );

		return () => {
			isMounted = false;
		};
	}, [ postId, previewBlockedReason ] );

	const fetchAppliedSchema = ( isRefresh = false ) => {
		if ( previewBlockedReason || ! postId ) {
			return;
		}

		const requestId = ++schemaRequestIdRef.current;

		setSchemaState( ( current ) => ( {
			...current,
			loading: ! isRefresh,
			refreshing: isRefresh,
			error: '',
		} ) );

		apiFetch( {
			path: `/slim-seo-preview/v1/post/${ postId }/schema`,
		} )
			.then( ( response ) => {
				if ( requestId !== schemaRequestIdRef.current ) {
					return;
				}

				setSchemaState( {
					loading: false,
					refreshing: false,
					error: '',
					data: response,
				} );
			} )
			.catch( ( error ) => {
				if ( requestId !== schemaRequestIdRef.current ) {
					return;
				}

				setSchemaState( ( current ) => ( {
					...current,
					loading: false,
					refreshing: false,
					error:
						error?.message ||
						__(
							'Slim SEO Preview could not load the applied schema graph.',
							'slim-seo-preview'
						),
				} ) );
			} );
	};

	useEffect( () => {
		if ( previewBlockedReason || ! postId ) {
			schemaRequestIdRef.current += 1;
			setSchemaState( {
				loading: false,
				refreshing: false,
				error: '',
				data: null,
			} );
			return;
		}

		fetchAppliedSchema();

		return () => {
			schemaRequestIdRef.current += 1;
		};
	}, [ postId, previewBlockedReason ] );

	useEffect( () => {
		if ( previewBlockedReason || ! postId ) {
			previewRequestIdRef.current += 1;
			setPreviewLoading( false );
			return undefined;
		}

		const timer = setTimeout( () => {
			const requestId = ++previewRequestIdRef.current;
			setPreviewLoading( true );
			setPreviewError( '' );

			Promise.all( [
				request( 'meta-tags/preview/post-title', {
					ID: postId,
					text: liveSlimSeoMeta.title,
					title: postTitle || '',
				} ),
				request( 'meta-tags/preview/post-description', {
					ID: postId,
					text: liveSlimSeoMeta.description,
					excerpt: postExcerpt || '',
					content: postContent || '',
				} ),
			] )
				.then( ( [ titleResponse, descriptionResponse ] ) => {
					if ( requestId !== previewRequestIdRef.current ) {
						return;
					}

					setPreview( {
						title: titleResponse?.preview || '',
						description: descriptionResponse?.preview || '',
					} );
				} )
				.catch( () => {
					if ( requestId !== previewRequestIdRef.current ) {
						return;
					}
					setPreviewError( config.strings?.restError || __( 'Slim SEO Preview could not load Slim SEO data.', 'slim-seo-preview' ) );
				} )
				.finally( () => {
					if ( requestId === previewRequestIdRef.current ) {
						setPreviewLoading( false );
					}
				} );
		}, 300 );

		return () => {
			clearTimeout( timer );
			previewRequestIdRef.current += 1;
		};
	}, [ previewBlockedReason, postId, postTitle, postExcerpt, postContent, liveSlimSeoMeta.title, liveSlimSeoMeta.description ] );

	const effectivePostNoindex = !! liveSlimSeoMeta.noindex;
	const effectiveNoindex = effectivePostNoindex || noindexState.postTypeNoindex;
	const indexStatus = effectiveNoindex
		? noindexState.postTypeNoindex
			? __( 'Noindex (locked by post type setting)', 'slim-seo-preview' )
			: __( 'Noindex (set for this item)', 'slim-seo-preview' )
		: __( 'Index', 'slim-seo-preview' );
	const previewTitle = preview.title || postTitle || '';
	const previewDescription = preview.description || '';
	const resolvedCanonicalUrl = liveSlimSeoMeta.canonical || permalink || config.homeUrl || '';
	const canonicalParts = getUrlParts( resolvedCanonicalUrl );
	const socialImageUrl = normalizeUrl(
		liveSlimSeoMeta.facebook_image ||
			liveSlimSeoMeta.twitter_image ||
			featuredImageUrl ||
			''
	);
	const searchQuery = clipText(
		postTitle || previewTitle || config.siteName || __( 'Search preview', 'slim-seo-preview' ),
		80
	);
	const schemaSourceUrl = getUrlParts(
		schemaState?.data?.url || resolvedCanonicalUrl
	).label;

	const handleToggleNoindex = ( nextValue ) => {
		const requestId = ++toggleRequestIdRef.current;
		setIsToggling( true );
		setToggleError( '' );

		apiFetch( {
			path: `/slim-seo-preview/v1/post/${ postId }/noindex`,
			method: 'POST',
			data: {
				noindex: nextValue,
			},
		} )
			.then( ( response ) => {
				if ( requestId !== toggleRequestIdRef.current ) {
					return;
				}

				setNoindexState( {
					postNoindex: !! response?.postNoindex,
					postTypeNoindex: !! response?.postTypeNoindex,
					effectiveNoindex: !! response?.effectiveNoindex,
					loading: false,
					error: '',
				} );
				syncMetaboxNoindexField( !! response?.postNoindex );
				setMetaboxState( ( current ) => ( {
					...current,
					values: {
						...current.values,
						noindex: !! response?.postNoindex,
					},
				} ) );
			} )
			.catch( () => {
				if ( requestId !== toggleRequestIdRef.current ) {
					return;
				}

				setToggleError( __( 'Failed to update the noindex state. Use the Slim SEO meta box below instead.', 'slim-seo-preview' ) );
			} )
			.finally( () => {
				if ( requestId === toggleRequestIdRef.current ) {
					setIsToggling( false );
				}
			} );
	};

	const handleJumpToMetabox = () => {
		const metabox = document.getElementById( config.metaboxId );
		if ( ! metabox ) {
			return;
		}

		metabox.scrollIntoView( {
			behavior: 'smooth',
			block: 'start',
		} );

		const firstField = metabox.querySelector( 'input, textarea, select, button' );
		firstField?.focus();
	};

	return (
		<PluginSidebar
			name="slim-seo-preview-sidebar"
			title={ __( 'Slim SEO Preview', 'slim-seo-preview' ) }
			icon="search"
			className="ssp-sidebar"
		>
			<div className="ssp-layout ssp-ui">
				{ ( noindexState.loading || previewLoading ) && ! previewBlockedReason && (
					<div className="ssp-loading">
						<Spinner />
					</div>
				) }

				{ previewBlockedReason && (
					<Notice status="warning" isDismissible={ false }>
						{ previewBlockedReason }
					</Notice>
				) }

				{ previewError && (
					<Notice status="error" isDismissible={ false }>
						{ previewError }
					</Notice>
				) }

				<SearchResultPreview
					title={ previewTitle }
					description={ previewDescription }
					urlParts={ canonicalParts }
					noindex={ effectiveNoindex }
					onOpenModal={ () => setIsSerpModalOpen( true ) }
				/>

				<SocialPreview
					title={ previewTitle }
					description={ previewDescription }
					urlParts={ canonicalParts }
					imageUrl={ socialImageUrl }
				/>

				<SchemaPreviewSection
					schemaState={ schemaState }
					sourceUrl={ schemaSourceUrl }
					onRefresh={ () => fetchAppliedSchema( true ) }
					onOpenModal={ () => setIsSchemaModalOpen( true ) }
				/>

				<PanelBody
					title={ __( 'Quick Controls', 'slim-seo-preview' ) }
					initialOpen
					className="ssp-panel-body"
				>
					<div className="ssp-controls">
						<div className="ssp-controls__meta">
							<div className="ssp-controls__label">{ __( 'Indexing status', 'slim-seo-preview' ) }</div>
							<div className="ssp-controls__value">{ indexStatus }</div>
						</div>

						{ toggleBlockedReason && (
							<Notice status="info" isDismissible={ false }>
								{ toggleBlockedReason }
							</Notice>
						) }

						{ noindexState.postTypeNoindex && (
							<Notice status="warning" isDismissible={ false }>
								{ config.strings?.globalNoindex || __( 'This post type is globally set to noindex in Slim SEO.', 'slim-seo-preview' ) }
							</Notice>
						) }

						{ toggleError && (
							<Notice status="error" isDismissible={ false }>
								{ toggleError }
							</Notice>
						) }

						<ToggleControl
							label={ __( 'Hide from search results', 'slim-seo-preview' ) }
							checked={ effectiveNoindex }
							onChange={ handleToggleNoindex }
							disabled={ ! supportsQuickEdit || isToggling || noindexState.postTypeNoindex }
							__nextHasNoMarginBottom
							help={
								! supportsQuickEdit
									? __( 'You do not have permission to update SEO settings for this item.', 'slim-seo-preview' )
									: noindexState.postTypeNoindex
										? __( 'Per-post editing is disabled because the whole post type is globally set to noindex.', 'slim-seo-preview' )
										: __(
											'This quick toggle saves directly from the sidebar. Other SEO fields still live in the Slim SEO meta box below.',
											'slim-seo-preview'
										)
							}
						/>

						<Button
							variant="secondary"
							onClick={ handleJumpToMetabox }
							disabled={ ! hasMetabox }
						>
							{ hasMetabox
								? ( config.strings?.jumpToMetabox || __( 'Jump to Slim SEO meta box', 'slim-seo-preview' ) )
								: ( config.strings?.metaboxMissing || __( 'The Slim SEO meta box could not be found on this screen.', 'slim-seo-preview' ) ) }
						</Button>
					</div>
				</PanelBody>
			</div>

			{ isSerpModalOpen && (
				<SerpPreviewModal
					title={ previewTitle }
					description={ previewDescription }
					urlParts={ canonicalParts }
					siteName={ config.siteName }
					searchQuery={ searchQuery }
					onRequestClose={ () => setIsSerpModalOpen( false ) }
				/>
			) }

			{ isSchemaModalOpen && (
				<SchemaPreviewModal
					schemaState={ schemaState }
					schemaSourceUrl={ schemaSourceUrl }
					onRefresh={ () => fetchAppliedSchema( true ) }
					onRequestClose={ () => setIsSchemaModalOpen( false ) }
				/>
			) }
		</PluginSidebar>
	);
}

registerPlugin( 'slim-seo-preview', {
	render: App,
	icon: 'search',
} );
