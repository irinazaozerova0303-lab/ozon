/*
 * CORS-прокси для Ozon Seller API и Performance API — для AI-агента Ozon.
 *
 * Зачем это нужно: ни Seller API (api-seller.ozon.ru), ни Performance API
 * (api-performance.ozon.ru) не отправляют заголовков CORS, поэтому браузер
 * блокирует запросы к ним напрямую со страницы агента. Этот воркер просто
 * пересылает запрос на Ozon и добавляет к ответу разрешающий заголовок. Он
 * не хранит, не логирует и никуда не отправляет ваши ключи — они лишь
 * пролетают через него транзитом от браузера к Ozon и обратно.
 *
 * Как развернуть/обновить (бесплатно, без сервера, ~2 минуты):
 *   1. dash.cloudflare.com → Workers & Pages → ваш воркер (или Create Worker,
 *      если разворачиваете впервые).
 *   2. Edit code → замените всё содержимое на этот файл целиком → Deploy.
 *   3. Адрес воркера (https://<имя>.workers.dev) — тот же, что и был,
 *      обновлять в настройках агента не нужно.
 *
 * Пути запросов от агента:
 *   <адрес воркера>/seller/<метод Seller API>
 *     Пример: .../seller/v4/product/info/stocks → https://api-seller.ozon.ru/v4/product/info/stocks
 *     Авторизация — заголовки Client-Id / Api-Key.
 *   <адрес воркера>/performance/<метод Performance API>
 *     Пример: .../performance/api/client/token → https://api-performance.ozon.ru/api/client/token
 *     Авторизация — заголовок Authorization (Bearer-токен добавляет сам агент).
 */

const HOSTS = {
  seller: 'https://api-seller.ozon.ru',
  performance: 'https://api-performance.ozon.ru',
};

export default {
  async fetch(request) {
    const cors = corsHeaders(request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    const url = new URL(request.url);
    const match = url.pathname.match(/^\/(seller|performance)\/(.+)$/);
    if (!match) {
      return new Response(
        'Не найдено. Обращайтесь по пути /seller/<метод Seller API> или /performance/<метод Performance API>.',
        { status: 404, headers: cors }
      );
    }

    const [, kind, rest] = match;
    const targetUrl = HOSTS[kind] + '/' + rest + url.search;

    const headers = { 'Content-Type': 'application/json' };
    if (kind === 'seller') {
      const clientId = request.headers.get('Client-Id') || '';
      const apiKey = request.headers.get('Api-Key') || '';
      if (!clientId || !apiKey) {
        return new Response('Отсутствуют заголовки Client-Id / Api-Key.', { status: 400, headers: cors });
      }
      headers['Client-Id'] = clientId;
      headers['Api-Key'] = apiKey;
    } else {
      const auth = request.headers.get('Authorization');
      if (auth) headers['Authorization'] = auth;
    }

    const init = { method: request.method, headers };
    if (!['GET', 'HEAD'].includes(request.method)) {
      init.body = await request.text();
    }

    let ozonResponse;
    try {
      ozonResponse = await fetch(targetUrl, init);
    } catch (err) {
      return new Response('Ошибка обращения к Ozon: ' + err.message, { status: 502, headers: cors });
    }

    const bodyText = await ozonResponse.text();
    return new Response(bodyText, {
      status: ozonResponse.status,
      headers: {
        ...cors,
        'Content-Type': ozonResponse.headers.get('Content-Type') || 'application/json',
      },
    });
  },
};

function corsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Client-Id, Api-Key, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}
