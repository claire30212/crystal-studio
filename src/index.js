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

    if (url.pathname === '/api/debug/schema') {
      const dbId = '1caf5a15-8543-8238-a4f2-817c65fc14a7';
      const res = await fetch(`https://api.notion.com/v1/databases/${dbId}`, {
        method: 'GET',
        headers,
      });
      const data = await res.json();
      return new Response(JSON.stringify({
        propertyNames: Object.keys(data.properties || {}),
        raw: data,
      }, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const INSPIRATION_DATA_SOURCE_ID = '0dc10f3c-23d2-42d5-a305-e55d5265606f';
    const NOTION_VERSION_V2 = '2025-09-03';
    const headersV2 = {
      'Authorization': `Bearer ${env.NOTION_TOKEN}`,
      'Notion-Version': NOTION_VERSION_V2,
      'Content-Type': 'application/json',
    };

    const CUSTOMER_DB_ID = 'd02486e4-623c-4d61-9433-3e77f4a21bb5';
    const INCOME_DB_ID = '1caf5a15-8543-8238-a4f2-817c65fc14a7';

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
      // 靈感筆記：讀取列表
      if (url.pathname === '/api/notion/inspiration' && request.method === 'GET') {
        let results = [];
        let cursor = undefined;
        let hasMore = true;
        while (hasMore) {
          const qbody = { page_size: 100 };
          if (cursor) qbody.start_cursor = cursor;
          const res = await fetch(`https://api.notion.com/v1/data_sources/${INSPIRATION_DATA_SOURCE_ID}/query`, {
            method: 'POST',
            headers: headersV2,
            body: JSON.stringify(qbody),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || 'Notion query failed');
          results = results.concat(data.results || []);
          hasMore = data.has_more;
          cursor = data.next_cursor;
        }
        return new Response(JSON.stringify({ results, count: results.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 靈感筆記：新增一則
      if (url.pathname === '/api/notion/inspiration' && request.method === 'POST') {
        const body = await request.json();
        const { title, content, tags, status, fileUploadId, filename } = body;

        const properties = {
          '標題': { title: [{ text: { content: title || '未命名靈感' } }] },
        };
        if (content) properties['內容'] = { rich_text: [{ text: { content } }] };
        if (tags && tags.length) properties['標籤'] = { multi_select: tags.map(t => ({ name: t })) };
        if (status) properties['狀態'] = { select: { name: status } };
        if (fileUploadId) {
          properties['圖片'] = { files: [{ type: 'file_upload', file_upload: { id: fileUploadId }, name: filename || 'image.jpg' }] };
        }

        const createRes = await fetch('https://api.notion.com/v1/pages', {
          method: 'POST',
          headers: headersV2,
          body: JSON.stringify({ parent: { data_source_id: INSPIRATION_DATA_SOURCE_ID }, properties }),
        });
        const createData = await createRes.json();
        if (!createRes.ok) throw new Error(createData.message || 'Notion create page failed');

        return new Response(JSON.stringify(createData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 靈感筆記：圖片上傳（兩步驟：建立上傳物件 → 送出實際檔案內容）
      if (url.pathname === '/api/notion/inspiration/upload-image' && request.method === 'POST') {
        const incomingForm = await request.formData();
        const file = incomingForm.get('file');
        const filename = incomingForm.get('filename') || 'image.jpg';
        if (!file) {
          return new Response(JSON.stringify({ error: 'No file provided' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const createRes = await fetch('https://api.notion.com/v1/file_uploads', {
          method: 'POST',
          headers: headersV2,
          body: JSON.stringify({ filename, content_type: file.type || 'image/jpeg' }),
        });
        const createData = await createRes.json();
        if (!createRes.ok) throw new Error(createData.message || 'Notion file_uploads create failed');

        const sendForm = new FormData();
        sendForm.append('file', file, filename);
        const sendRes = await fetch(`https://api.notion.com/v1/file_uploads/${createData.id}/send`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${env.NOTION_TOKEN}`, 'Notion-Version': NOTION_VERSION_V2 },
          body: sendForm,
        });
        const sendData = await sendRes.json();
        if (!sendRes.ok) throw new Error(sendData.message || 'Notion file upload send failed');

        return new Response(JSON.stringify({ fileUploadId: createData.id, filename }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

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
