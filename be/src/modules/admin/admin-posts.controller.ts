import {
  Body,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AdminController, CurrentUser } from '../../auth/decorators';
import { AuthUser } from '../../auth/jwt.strategy';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import {
  AdminPostsService,
  CreatePost,
  createPostSchema,
  ListAdminPostsQuery,
  listAdminPostsQuery,
  schedulePostSchema,
  UpdatePost,
  updatePostSchema,
} from './admin-posts.service';

@AdminController('posts')
export class AdminPostsController {
  constructor(private readonly posts: AdminPostsService) {}

  @Get()
  list(@Query(new ZodPipe(listAdminPostsQuery)) query: ListAdminPostsQuery) {
    return this.posts.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.posts.get(id);
  }

  @Post()
  create(
    @Body(new ZodPipe(createPostSchema)) dto: CreatePost,
    @CurrentUser() user: AuthUser,
  ) {
    return this.posts.create(dto, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodPipe(updatePostSchema)) dto: UpdatePost,
  ) {
    return this.posts.update(id, dto);
  }

  @Post(':id/publish')
  @HttpCode(200)
  publish(@Param('id') id: string) {
    return this.posts.publish(id);
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  unpublish(@Param('id') id: string) {
    return this.posts.unpublish(id);
  }

  @Post(':id/schedule')
  @HttpCode(200)
  schedule(
    @Param('id') id: string,
    @Body(new ZodPipe(schedulePostSchema)) body: { publishedAt: Date },
  ) {
    return this.posts.schedule(id, body.publishedAt);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.posts.remove(id);
  }
}
