import { ConfigService } from '@nestjs/config';
import { RevalidateService } from './revalidate.service';
import { noteTags, postTags } from './revalidate.tags';

const config = {
  getOrThrow: (k: string) =>
    ({
      WEB_REVALIDATE_URL: 'http://web/api/revalidate',
      REVALIDATE_SECRET: 's3cret',
    })[k],
} as unknown as ConfigService;

describe('revalidate tags', () => {
  it('maps posts and infographics to distinct tags', () => {
    expect(postTags({ slug: 'a', kind: 'POST' })).toEqual(
      expect.arrayContaining(['posts', 'post:a', 'home', 'feed']),
    );
    expect(postTags({ slug: 'a', kind: 'INFOGRAPHIC' })).toEqual(
      expect.arrayContaining(['infographics', 'infographic:a']),
    );
    expect(noteTags({ slug: 'n' })).toContain('note:n');
  });
});

describe('RevalidateService', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it('batches and de-duplicates tags into one request with the secret header', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as never;
    const svc = new RevalidateService(config);
    svc.trigger(['posts', 'home']);
    svc.trigger(['home', 'feed']);
    expect(await svc.flush()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://web/api/revalidate');
    expect(init.headers['x-revalidate-secret']).toBe('s3cret');
    expect(JSON.parse(init.body).tags.sort()).toEqual([
      'feed',
      'home',
      'posts',
    ]);
  });

  it('does nothing when there are no pending tags', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as never;
    expect(await new RevalidateService(config).flush()).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retries on failure and eventually succeeds', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce({ ok: true, status: 200 });
    global.fetch = fetchMock as never;
    const svc = new RevalidateService(config);
    svc.trigger(['posts']);
    expect(await svc.flush()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 401 and never throws', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 401 });
    global.fetch = fetchMock as never;
    const svc = new RevalidateService(config);
    svc.trigger(['posts']);
    await expect(svc.flush()).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
