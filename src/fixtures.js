// Sample tRPC exchanges, used by the tests and by the panel's demo mode
// (open panel.html outside DevTools to see them).

const enc = (value) => encodeURIComponent(JSON.stringify(value));

export const fixtures = [
  {
    name: 'batched GET with superjson',
    url:
      'http://localhost:3000/api/trpc/post.byId,user.me?batch=1&input=' +
      enc({
        0: { json: { id: 42 } },
        1: { json: null, meta: { values: ['undefined'] } },
      }),
    method: 'GET',
    status: 200,
    duration: 38,
    responseBody: JSON.stringify([
      {
        result: {
          data: {
            json: {
              id: 42,
              title: 'Hello tRPC',
              createdAt: '2026-10-29T12:00:00.000Z',
              tags: ['news', 'trpc'],
              views: '9007199254740993',
            },
            meta: { values: { createdAt: ['Date'], tags: ['set'], views: ['bigint'] } },
          },
        },
      },
      {
        result: {
          data: {
            json: { id: 'u_1', name: 'Thomas', roles: [['admin', true]] },
            meta: { values: { roles: ['map'] } },
          },
        },
      },
    ]),
  },
  {
    name: 'plain JSON mutation (httpLink, no transformer)',
    url: 'http://localhost:3000/api/trpc/post.create',
    method: 'POST',
    status: 200,
    duration: 112,
    requestBody: JSON.stringify({ title: 'New post', body: 'Lorem ipsum' }),
    responseBody: JSON.stringify({ result: { data: { id: 43, title: 'New post' } } }),
  },
  {
    name: 'batched mutation with an error',
    url: 'http://localhost:3000/api/trpc/post.delete?batch=1',
    method: 'POST',
    status: 403,
    duration: 21,
    requestBody: JSON.stringify({ 0: { json: { id: 1 } } }),
    responseBody: JSON.stringify([
      {
        error: {
          json: {
            message: 'You are not allowed to delete this post',
            code: -32603,
            data: { code: 'FORBIDDEN', httpStatus: 403, path: 'post.delete' },
          },
        },
      },
    ]),
  },
];
