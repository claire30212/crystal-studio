export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    const NOTION_VERSION = '2022-06-28';
    const headers = {
      'Authorization': `Bearer ${env.NOTION_TOKEN}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    };

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const CUSTOMER_DB_ID = 'd02486e4-623c-4d61-9433-3e77f4a21bb5';
    const INCOME_DB_ID = '263f5a15-8543-8124-a23c-f55e515f9dc3';

    // 分頁抓取，確保拿到完整資料，不會漏掉超過 100 筆的部分
    async function fetchAllNotion(dbId) {
      let results = [];
      let cursor = undefined;
      let hasMore = true;

      while (hasMore) {
        const body = { page_size: 100 };
        if (cursor) body.start_cursor = cursor;

        const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || 'Notion API error');
        }

        results = results.concat(data.results || []);
        hasMore = data.has_more;
        cursor = data.next_cursor;
      }

      return results;
    }

    try {
      let dbId;
      if (url.pathname === '/api/notion/customers') {
        dbId = CUSTOMER_DB_ID;
      } else if (url.pathname === '/api/notion/income') {
        dbId = INCOME_DB_ID;
      } else {
        return new Response(JSON.stringify({ error: 'Unknown endpoint' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const results = await fetchAllNotion(dbId);

      return new Response(JSON.stringify({ results, count: results.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
