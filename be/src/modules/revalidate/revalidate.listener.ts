import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Events, PostEvent, SlugEvent } from '../../common/events';
import {
  noteTags,
  pageTags,
  postTags,
  seriesTags,
  siteTags,
  taxonomyTags,
} from './revalidate.tags';
import { RevalidateService } from './revalidate.service';

@Injectable()
export class RevalidateListener {
  constructor(private readonly revalidate: RevalidateService) {}

  @OnEvent(Events.PostPublished)
  @OnEvent(Events.PostUpdated)
  onPost(e: PostEvent) {
    this.revalidate.trigger(postTags(e));
  }

  @OnEvent(Events.NotePublished)
  @OnEvent(Events.NoteUpdated)
  onNote(e: SlugEvent) {
    this.revalidate.trigger(noteTags(e));
  }

  @OnEvent(Events.SeriesUpdated)
  onSeries(e: SlugEvent) {
    this.revalidate.trigger(seriesTags(e));
  }

  @OnEvent(Events.PageUpdated)
  onPage(e: SlugEvent) {
    this.revalidate.trigger(pageTags(e));
  }

  @OnEvent(Events.SiteUpdated)
  onSite() {
    this.revalidate.trigger(siteTags());
  }

  @OnEvent(Events.TaxonomyUpdated)
  onTaxonomy() {
    this.revalidate.trigger(taxonomyTags());
  }
}
