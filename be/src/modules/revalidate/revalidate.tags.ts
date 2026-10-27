import { PostEvent, SlugEvent } from '../../common/events';

/**
 * Next cache tags per content change (see ARCHITECTURE.md §7.1). The web app tags
 * `/series/[slug]` with both `series` and `series:<slug>`, since a post change can
 * affect its series page but the event doesn't carry the series slug.
 */
export const postTags = ({ slug, kind }: PostEvent) =>
  kind === 'POST'
    ? ['posts', `post:${slug}`, 'home', 'feed', 'series']
    : ['infographics', `infographic:${slug}`, 'home', 'feed', 'series'];

export const noteTags = ({ slug }: SlugEvent) => [
  'notes',
  `note:${slug}`,
  'home',
  'feed',
];
export const seriesTags = ({ slug }: SlugEvent) => [
  'series',
  `series:${slug}`,
  'home',
];
export const pageTags = ({ slug }: SlugEvent) => [`page:${slug}`, 'feed'];
/** Site name/tagline/cover show in every page's metadata, the header and the feed. */
export const siteTags = () => ['site', 'home', 'feed'];
export const taxonomyTags = () => ['posts', 'notes', 'infographics', 'home'];

/** Used for a full refresh, e.g. after a deploy. */
export const ALL_TAGS = [
  'site',
  'posts',
  'notes',
  'infographics',
  'series',
  'home',
  'feed',
  'page:about',
];
