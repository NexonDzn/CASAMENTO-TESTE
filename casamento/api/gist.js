// api/gist.js
export default async function handler(req, res) {
    const GIST_ID = '587d4828137c2547940d03c72523951b';
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // variável de ambiente do Vercel

    if (!GITHUB_TOKEN) {
        return res.status(500).json({ error: 'Token não configurado no servidor' });
    }

    const GIST_API_URL = `https://api.github.com/gists/${GIST_ID}`;

    if (req.method === 'GET') {
        try {
            const response = await fetch(GIST_API_URL, {
                headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}` }
            });
            if (!response.ok) throw new Error(`GitHub API: ${response.status}`);
            const gist = await response.json();
            const content = gist.files['wedding-data.json']?.content;
            if (!content) throw new Error('Arquivo wedding-data.json não encontrado');
            res.status(200).json(JSON.parse(content));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    } 
    else if (req.method === 'POST') {
        try {
            const newData = req.body;
            const body = {
                files: {
                    'wedding-data.json': { content: JSON.stringify(newData, null, 2) }
                }
            };
            const response = await fetch(GIST_API_URL, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            if (!response.ok) throw new Error(`GitHub API: ${response.status}`);
            res.status(200).json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    } 
    else {
        res.status(405).end();
    }
}