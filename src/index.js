export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 只攔截 /api/ 開頭的請求，其他一律交給靜態網站處理
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

      const notionRes = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ page_size: 100 }),
      });

      const data = await notionRes.json();

      return new Response(JSON.stringify(data), {
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
