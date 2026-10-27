import { Controller, Get, Param, Query } from '@nestjs/common';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { ListPostsQuery, listPostsQuery, PostsService } from './posts.service';

@Controller()
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Get('posts')
  list(@Query(new ZodPipe(listPostsQuery)) query: ListPostsQuery) {
    return this.posts.list(query);
  }

  // Declared before ':slug' routes so 'redirects' isn't taken for a slug.
  @Get('redirects/:section/:slug')
  redirect(@Param('section') section: string, @Param('slug') slug: string) {
    return this.posts.redirectFor(section, slug);
  }

  @Get('posts/:slug')
  get(@Param('slug') slug: string) {
    return this.posts.bySlug(slug, 'POST');
  }

  // Alias of /posts?kind=infographic
  @Get('infographics')
  listInfographics(@Query(new ZodPipe(listPostsQuery)) query: ListPostsQuery) {
    return this.posts.list({ ...query, kind: 'infographic' });
  }

  @Get('infographics/:slug')
  getInfographic(@Param('slug') slug: string) {
    return this.posts.bySlug(slug, 'INFOGRAPHIC');
  }
}
