import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { SearchQuery, SearchService, searchQuery } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  // Full-text queries are the costliest public endpoint, so they get their own per-IP limit.
  @Get()
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: () => Number(process.env.SEARCH_RATE_LIMIT) || 30,
      ttl: 60_000,
    },
  })
  get(@Query(new ZodPipe(searchQuery)) query: SearchQuery) {
    return this.search.search(query);
  }
}
