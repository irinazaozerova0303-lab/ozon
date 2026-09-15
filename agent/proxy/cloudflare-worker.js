/*
 * CORS-прокси для Ozon Seller API — для AI-агента Ozon.
 *
 * Зачем это нужно: Ozon Seller API (api-seller.ozon.ru) не отправляет
 * заголовков CORS, поэтому браузер блокирует запросы к нему напрямую со
 * страницы агента. Этот воркер просто пересылает запрос на Ozon и
 * добавляет к ответу заголовок Access-Control-Allow-Origin. Он не хранит,
 * не логирует и никуда не отправляет ваш Client-Id/Api-Key — они лишь
 * пролетают через него транзитом от браузера к Ozon и обратно.
 *
 * Как развернуть (бесплатно, без сервера, ~2 минуты):
 *   1. dash.cloudflare.com → зарегистрируйтесь.
 *   2. Workers & Pages → Create Worker.
 *   3. Замените код-заготовку на этот файл целиком → Deploy.
 *   4. Скопируйте адрес вида https://<имя>.workers.dev и вставьте его в
 *      настройках агента как «Адрес прокси-сервера».
 *
 * Путь запроса от агента: <адрес воркера>/seller/<метод Ozon API>
 * Пример: .../seller/v4/product/info/stocks → https://api-seller.ozon.ru/v4/product/info/stocks
 */

const OZON_SELLER_HOST = 'https://api-seller.ozon.ru';

export default {
  async fetch(request) {
    const cors = corsHeaders(request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    const url = new URL(request.url);
    const match = url.pathname.match(/^\/seller\/(.+)$/);
    if (!match) {
      return new Response(
        'Не найдено. Обращайтесь по пути /seller/<метод Ozon Seller API>, например /seller/v4/product/info/stocks',
        { status: 404, headers: cors }
      );
    }

    const targetUrl = OZON_SELLER_HOST + '/' + match[1] + url.search;
    const clientId = request.headers.get('Client-Id') || '';
    const apiKey = request.headers.get('Api-Key') || '';

    if (!clientId || !apiKey) {
      return new Response('Отсутствуют заголовки Client-Id / Api-Key.', { status: 400, headers: cors });
    }

    const init = {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': clientId,
        'Api-Key': apiKey,
      },
    };
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
    'Access-Control-Allow-Headers': 'Content-Type, Client-Id, Api-Key',
    'Access-Control-Max-Age': '86400',
  };
}
