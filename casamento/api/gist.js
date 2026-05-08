// api/gist.js
export default async function handler(req, res) {
    // Permitir CORS para desenvolvimento local (opcional)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const GIST_ID = '587d4828137c2547940d03c72523951b';
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

    if (!GITHUB_TOKEN) {
        console.error('GITHUB_TOKEN não configurado');
        return res.status(500).json({ error: 'Token não configurado no servidor' });
    }

    const GIST_API_URL = `https://api.github.com/gists/${GIST_ID}`;

    try {
        if (req.method === 'GET') {
            const response = await fetch(GIST_API_URL, {
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error('GitHub GET error:', response.status, errorText);
                return res.status(response.status).json({ error: `GitHub API error: ${response.status}` });
            }
            const gist = await response.json();
            const content = gist.files['wedding-data.json']?.content;
            if (!content) {
                // Se o arquivo não existir, cria um vazio
                const emptyData = { guests: [], gifts: [] };
                const createRes = await fetch(GIST_API_URL, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `token ${GITHUB_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        files: {
                            'wedding-data.json': { content: JSON.stringify(emptyData, null, 2) }
                        }
                    })
                });
                if (createRes.ok) {
                    return res.status(200).json(emptyData);
                } else {
                    return res.status(500).json({ error: 'Não foi possível criar wedding-data.json' });
                }
            }
            return res.status(200).json(JSON.parse(content));
        } 
        else if (req.method === 'POST') {
            const newData = req.body;
            const body = {
                files: {
                    'wedding-data.json': { content: JSON.stringify(newData, null, 2) }
                }
            };
            const response = await fetch(GIST_API_URL, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error('GitHub PATCH error:', response.status, errorText);
                return res.status(response.status).json({ error: `GitHub API error: ${response.status}` });
            }
            return res.status(200).json({ success: true });
        } 
        else {
            res.status(405).end();
        }
    } catch (err) {
        console.error('API route error:', err);
        res.status(500).json({ error: err.message });
    }
}
